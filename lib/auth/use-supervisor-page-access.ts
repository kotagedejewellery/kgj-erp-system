"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientUser } from "@/lib/auth/session";
import {
  getSupervisorPageAccess,
  type SupervisorPageAccess,
} from "@/lib/auth/supervisor-page-access";

interface SupervisorPageAccessState {
  access: SupervisorPageAccess | null;
  isResolved: boolean;
  userEmail: string;
}

function getInitialState(): SupervisorPageAccessState {
  const user = getClientUser();
  const access = getSupervisorPageAccess(user?.roleDetail);

  return {
    access,
    isResolved: access !== null,
    userEmail: user?.username || user?.fullName || "",
  };
}

export function useSupervisorPageAccess(): SupervisorPageAccessState {
  const router = useRouter();
  const [state, setState] = useState(getInitialState);

  useEffect(() => {
    let active = true;

    fetch("/api/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((json) => {
        if (!active) return;

        const access = getSupervisorPageAccess(json?.data?.role);
        if (!access) {
          router.replace("/workshop/login");
          return;
        }

        setState({
          access,
          isResolved: true,
          userEmail: json.data.username || json.data.full_name || "",
        });
      })
      .catch(() => {
        if (active) router.replace("/workshop/login");
      });

    return () => {
      active = false;
    };
  }, [router]);

  return state;
}
