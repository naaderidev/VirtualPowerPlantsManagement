import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-muted rounded-full w-fit">
            {icon || <FileText className="h-8 w-8 text-muted-foreground" />}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {actionLabel && actionHref && (
            <Link href={actionHref}>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                {actionLabel}
              </Button>
            </Link>
          )}
          {actionLabel && onAction && (
            <Button onClick={onAction}>
              <Plus className="h-4 w-4 ml-2" />
              {actionLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmptyStateSimple({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-12">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
