"use client";

import { useRouter } from "next/navigation";
import { ConvictionVoter } from "./ConvictionVoter";

interface Props {
  companyId: string;
  companyName: string;
  existingVote?: { conviction: number; rationale?: string | null };
}

export function ConvictionVoterWrapper({ companyId, companyName, existingVote }: Props) {
  const router = useRouter();

  return (
    <ConvictionVoter
      companyId={companyId}
      companyName={companyName}
      existingVote={existingVote}
      onVoted={() => router.refresh()}
    />
  );
}
