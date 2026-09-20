import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Clock, Circle, X } from "lucide-react";
import type { RequestStatus } from "@/domain/requests";

interface Step {
  status: RequestStatus;
  label: string;
  isCurrent?: boolean;
  isCompleted?: boolean;
}

interface WorkflowTimelineProps {
  currentStatus: RequestStatus;
  steps?: Step[];
}

const defaultSteps: { status: RequestStatus; label: string }[] = [
  { status: "SUBMITTED", label: "درخواست ثبت شد" },
  { status: "INITIAL_REVIEW", label: "بررسی اولیه" },
  { status: "OWNERSHIP_REVIEW", label: "بررسی مالکیت" },
  { status: "PROPOSAL_READY", label: "پیشنهاد قیمت" },
  { status: "CONTRACT_PENDING", label: "قرارداد" },
  { status: "ACTIVE", label: "اجرا" },
  { status: "SETTLED", label: "تسویه" },
  { status: "COMPLETED", label: "پرداخت" },
];

const statusOrder: RequestStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "INITIAL_REVIEW",
  "NEEDS_INFORMATION",
  "INFORMATION_SUBMITTED",
  "APPROVED",
  "OWNERSHIP_REVIEW",
  "PROPOSAL_PENDING",
  "PROPOSAL_READY",
  "PROPOSAL_ACCEPTED",
  "CONTRACT_PENDING",
  "CONTRACT_SIGNED",
  "ACTIVE",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "COMPLETED",
];

function getStatusIndex(status: RequestStatus): number {
  return statusOrder.indexOf(status);
}

function getStepState(
  stepStatus: RequestStatus,
  currentStatus: RequestStatus
): "completed" | "current" | "upcoming" | "rejected" | "cancelled" {
  if (currentStatus === "REJECTED") return "rejected";
  if (currentStatus === "CANCELLED") return "cancelled";
  
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
  cancelled: {
    icon: X,
    className: "bg-gray-100 text-gray-400",
    lineClassName: "bg-gray-200",
  },
};

export function WorkflowTimeline({ currentStatus, steps }: Readonly<WorkflowTimelineProps>) {
  const displaySteps = steps || defaultSteps;

  return (
    <div className="space-y-4">
      <h3 className="font-medium">مسیر درخواست</h3>
      <div className="relative">
        {displaySteps.map((step, index) => {
          const state = getStepState(step.status, currentStatus);
          const config = stateConfig[state];
          const Icon = config.icon;
          const isLast = index === displaySteps.length - 1;

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
                    (state === "rejected" || state === "cancelled") && "text-muted-foreground line-through"
                  )}
                >
                  {step.label}
                </p>
                {state === "current" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    شما اینجایید
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
