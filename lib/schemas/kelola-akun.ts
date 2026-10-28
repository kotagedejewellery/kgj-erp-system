// lib/schemas/kelola-akun.ts

import { z } from "zod";

export const BmsUserSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["superadmin", "after_sales"]),
});

export const BmsEditUserSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  role: z.enum(["superadmin", "after_sales"]),
});

export const OprprdUserSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role_id: z.string().min(1, "Role wajib dipilih"),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const OprprdEditUserSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  role_id: z.string().min(1, "Role wajib dipilih"),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const SupervisorUserSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["operational_supervisor", "production_supervisor", "customer_service_supervisor"], {
    message: "Role wajib dipilih",
  }),
});

export const SupervisorEditUserSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  role: z.enum(["operational_supervisor", "production_supervisor", "customer_service_supervisor"], {
    message: "Role wajib dipilih",
  }),
});

export const ManagementUserSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.string().min(1, "Leader role wajib dipilih"),
});

export const ManagementEditUserSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  role: z.string().min(1, "Leader role wajib dipilih"),
});
