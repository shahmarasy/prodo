import type { FixProposal, FixResult } from "../core/fix";

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

type ClackModule = {
  intro: (title: string) => void;
  outro: (message: string) => void;
  cancel: (message: string) => void;
  confirm: (opts: { message: string }) => Promise<boolean | symbol>;
  isCancel: (value: unknown) => boolean;
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    step: (message: string) => void;
  };
};

async function loadClack(): Promise<ClackModule | null> {
  try {
    return (await dynamicImport("@clack/prompts")) as ClackModule;
  } catch {
    return null;
  }
}

export async function displayFixProposal(
  proposal: FixProposal,
  log: (message: string) => void
): Promise<void> {
  const errorCount = proposal.issues.filter((i) => i.level === "error").length;
  const warningCount = proposal.issues.filter((i) => i.level === "warning").length;

  log("");
  log(`Fix Proposal`);
  log(`${"─".repeat(50)}`);
  log(`Issues found: ${errorCount} error(s), ${warningCount} warning(s)`);
  log(`Artifacts to regenerate: ${proposal.targets.join(", ")}`);
  log("");

  for (const [type, issues] of proposal.issuesByArtifact) {
    log(`  ${type.toUpperCase()} (${issues.length} issue${issues.length > 1 ? "s" : ""}):`);
    for (const issue of issues) {
      const prefix = issue.level === "error" ? "  ✖" : "  ⚠";
      log(`    ${prefix} [${issue.code}] ${issue.message}`);
      if (issue.suggestion) {
        log(`      → ${issue.suggestion}`);
      }
    }
    log("");
  }

  const orphanIssues = proposal.issues.filter((i) => !i.artifactType);
  if (orphanIssues.length > 0) {
    log(`  General (${orphanIssues.length} issue${orphanIssues.length > 1 ? "s" : ""}):`);
    for (const issue of orphanIssues) {
      const prefix = issue.level === "error" ? "  ✖" : "  ⚠";
      log(`    ${prefix} [${issue.code}] ${issue.message}`);
    }
    log("");
  }
}

export async function confirmFixExecution(
  proposal: FixProposal
): Promise<boolean> {
  if (process.stdout.isTTY !== true) {
    return true;
  }

  const clack = await loadClack();
  if (!clack) {
    return true;
  }

  clack.intro("Prodo Fix");

  const proceed = await clack.confirm({
    message: `Regenerate ${proposal.targets.length} artifact(s): ${proposal.targets.join(", ")}?`
  });

  if (clack.isCancel(proceed)) {
    clack.cancel("Fix cancelled.");
    return false;
  }

  return proceed === true;
}

export async function displayFixResult(
  result: FixResult,
  log: (message: string) => void
): Promise<void> {
  log("");
  if (result.finalPass) {
    log("Fix complete — validation passed.");
  } else {
    log("Fix applied but validation still failing.");
    log(`Review report: ${result.reportPath}`);
    if (result.backupDir) {
      log(`Backup saved: ${result.backupDir}`);
    }
  }

  const clack = await loadClack();
  if (clack && process.stdout.isTTY) {
    clack.outro(result.finalPass ? "All gates passed!" : "Review report and retry.");
  }
}
