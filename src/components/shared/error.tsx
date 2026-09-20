import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-destructive/10 rounded-full w-fit">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>خطا در بارگذاری</CardTitle>
          <CardDescription>
            متأسفانه خطایی رخ داده است. لطفاً دوباره تلاش کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {error.message && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              {error.message}
            </div>
          )}
          <Button onClick={reset} variant="outline">
            <RefreshCw className="h-4 w-4 ml-2" />
            تلاش مجدد
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
