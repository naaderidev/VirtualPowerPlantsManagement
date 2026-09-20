import { cn } from "@/lib/utils";
import { Check, Clock, Circle, X, FileSignature, AlertTriangle } from "lucide-react";
import type { ContractStatus } from "@/domain/contracts";

interface ContractTimelineProps {
  currentStatus: ContractStatus;
}

const defaultSteps: { status: ContractStatus; label: string }[] = [
  { status: "DRAFT", label: "پیش‌نویس" },
  { status: "CONFIGURED", label: "پیکربندی" },
  { status: "INTERNAL_REVIEW", label: "بررسی داخلی" },
  { status: "PENDING_SIGNATURE", label: "منتظر امضا" },
  { status: "SIGNED", label: "امضا شده" },
  { status: "ACTIVE", label: "فعال" },
];

const statusOrder: ContractStatus[] = [
  "DRAFT",
  "CONFIGURED",
  "INTERNAL_REVIEW",
  "NEEDS_CHANGES",
  "PENDING_SIGNATURE",
  "SIGNED",
  "ACTIVE",
  "AMENDMENT_PENDING",
  "TERMINATION_PENDING",
  "TERMINATED",
  "EXPIRED",
];

function getStatusIndex(status: ContractStatus): number {
  return statusOrder.indexOf(status);
}

function getStepState(
  stepStatus: ContractStatus,
  currentStatus: ContractStatus
): "completed" | "current" | "upcoming" | "rejected" | "terminated" {
  if (currentStatus === "TERMINATED" || currentStatus === "EXPIRED") return "terminated";
  if (currentStatus === "REJECTED" || currentStatus === "CANCELLED") return "rejected";
  
  const currentIndex = getStatusIndex(currentStatus);
  const stepIndex = getStatusIndex(stepStatus);
  
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

const stateConfig = {
  completed: {
    icon: Check,
    className: "bg-teal-600 text-white",
    lineClassName: "bg-teal-600",
  },
  current: {
    icon: Clock,
    className: "bg-primary text-primary-foreground",
    lineClassName: "bg-gray-200",
  },
  upcoming: {
    icon: Circle,
    className: "bg-gray-100 text-gray-400",
    lineClassName: "bg-gray-200",
  },
  rejected: {
    icon: X,
    className: "bg-destructive text-destructive-foreground",
    lineClassName: "bg-gray-200",
  },
  terminated: {
    icon: AlertTriangle,
    className: "bg-orange-100 text-orange-600",
    lineClassName: "bg-gray-200",
  },
};

export function ContractTimeline({ currentStatus }: Readonly<ContractTimelineProps>) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <FileSignature className="h-4 w-4" />
        چرخه عمر قرارداد
      </h3>
      <div className="relative">
        {defaultSteps.map((step, index) => {
          const state = getStepState(step.status, currentStatus);
          const config = stateConfig[state];
          const Icon = config.icon;
          const isLast = index === defaultSteps.length - 1;

          return (
            <div key={step.status} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    config.className
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 h-8",
                      state === "completed" ? config.lineClassName : "bg-gray-200"
                    )}
                  />
                )}
              </div>
              <div className={cn("pb-8", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-medium",
                    state === "current" && "text-primary",
                    state === "completed" && "text-teal-600",
                    state === "upcoming" && "text-muted-foreground",
                    (state === "rejected" || state === "terminated") && "text-muted-foreground line-through"
                  )}
                >
                  {step.label}
                </p>
                {state === "current" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    مرحله فعلی
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
