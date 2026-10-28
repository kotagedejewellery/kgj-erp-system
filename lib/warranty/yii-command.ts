import { createHash, createHmac } from "crypto";
import { createWarrantyPathSignature } from "@/lib/warranty/push-activation";

const WARRANTY_COMMAND_TIMEOUT_MS = 15_000;

export type YiiWarrantyResponse = {
  status: number;
  body: Record<string, unknown> | null;
  error: string | null;
};

export function createWarrantyMultipartSignature(
  secret: string,
  path: string,
  timestamp: string,
  claimReference: string,
  checksum: string,
  fileSizeBytes: number,
): string {
  const canonical = `POST\n${path}\n${timestamp}\nmultipart\n${claimReference}\n${checksum}\n${fileSizeBytes}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

function commandUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

async function sendYiiWarrantyRequest(
  path: string,
  payload: Record<string, unknown>,
  maximumAttempts: number,
): Promise<YiiWarrantyResponse> {
  const baseUrl = process.env.WARRANTY_YII2_BASE_URL;
  const secret = process.env.WARRANTY_MAIN_ERP_SECRET;
  if (!baseUrl || !secret) {
    return { status: 503, body: null, error: "Konfigurasi koneksi Warranty Core belum lengkap" };
  }

  const body = JSON.stringify(payload);
  let lastError = "Warranty Core tidak dapat dihubungi";
  for (let attempt = 0; attempt < maximumAttempts; attempt++) {
    const timestamp = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WARRANTY_COMMAND_TIMEOUT_MS);
    try {
      const response = await fetch(commandUrl(baseUrl, path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Warranty-Key-Id": process.env.WARRANTY_MAIN_ERP_KEY_ID || "main-erp",
          "X-Warranty-Timestamp": timestamp,
          "X-Warranty-Signature": `v1=${createWarrantyPathSignature(secret, path, timestamp, body)}`,
        },
        body,
        signal: controller.signal,
      });
      const text = await response.text().catch(() => "");
      let responseBody: Record<string, unknown> | null = null;
      try {
        responseBody = text ? JSON.parse(text) as Record<string, unknown> : null;
      } catch {
        responseBody = null;
      }
      if (response.status < 500) {
        return {
          status: response.status,
          body: responseBody,
          error: response.ok ? null : String((responseBody?.error as Record<string, unknown> | undefined)?.message ?? `HTTP ${response.status}`),
        };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError"
        ? "Timeout menghubungi Warranty Core"
        : error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { status: 503, body: null, error: lastError };
}

export function sendYiiWarrantyCommand(
  path: string,
  payload: Record<string, unknown>,
): Promise<YiiWarrantyResponse> {
  return sendYiiWarrantyRequest(path, payload, 3);
}

export function sendYiiWarrantyQuery(
  path: string,
  payload: Record<string, unknown>,
): Promise<YiiWarrantyResponse> {
  return sendYiiWarrantyRequest(path, payload, 2);
}

export async function sendYiiWarrantyAttachment(
  claimReference: string,
  file: File,
): Promise<YiiWarrantyResponse> {
  const baseUrl = process.env.WARRANTY_YII2_BASE_URL;
  const secret = process.env.WARRANTY_MAIN_ERP_SECRET;
  if (!baseUrl || !secret) {
    return { status: 503, body: null, error: "Konfigurasi koneksi Warranty Core belum lengkap" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const timestamp = new Date().toISOString();
  const path = "/api/warranty/v1/attachments";
  const form = new FormData();
  form.set("claim_reference", claimReference);
  form.set("sha256", checksum);
  form.set("file_size_bytes", String(bytes.byteLength));
  form.set("file", new Blob([bytes], { type: file.type }), file.name);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WARRANTY_COMMAND_TIMEOUT_MS);
  try {
    const response = await fetch(commandUrl(baseUrl, path), {
      method: "POST",
      headers: {
        "X-Warranty-Key-Id": process.env.WARRANTY_MAIN_ERP_KEY_ID || "main-erp",
        "X-Warranty-Timestamp": timestamp,
        "X-Warranty-Signature": `v1=${createWarrantyMultipartSignature(secret, path, timestamp, claimReference, checksum, bytes.byteLength)}`,
      },
      body: form,
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    let body: Record<string, unknown> | null = null;
    try {
      body = text ? JSON.parse(text) as Record<string, unknown> : null;
    } catch {
      body = null;
    }
    return {
      status: response.status,
      body,
      error: response.ok ? null : String((body?.error as Record<string, unknown> | undefined)?.message ?? `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      status: 503,
      body: null,
      error: error instanceof Error && error.name === "AbortError"
        ? "Timeout menghubungi Warranty Core"
        : error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
