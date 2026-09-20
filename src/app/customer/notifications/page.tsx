"use client";

import { formatPersianDateTime } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, CheckCircle2, AlertTriangle,
  Mail, MailOpen, Loader2
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link: string | null;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  INVOICE: { label: "صورتحساب", color: "text-blue-500" },
  SETTLEMENT: { label: "تسویه", color: "text-orange-500" },
  PAYMENT: { label: "پرداخت", color: "text-green-500" },
  CONTRACT: { label: "قرارداد", color: "text-primary" },
  REQUEST: { label: "درخواست", color: "text-purple-500" },
  ALERT: { label: "هشدار", color: "text-destructive" },
};

export default function CustomerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("خطا");
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      console.error("خطا در دریافت اعلان‌ها");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      if (!response.ok) throw new Error("خطا در ثبت وضعیت اعلان");
      const result: { count: number } = await response.json();
      if (result.count === 0) return false;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return true;
    } catch {
      console.error("خطا");
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (!response.ok) throw new Error("خطا در ثبت وضعیت اعلان‌ها");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      console.error("خطا");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">اعلان‌ها</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} اعلان خوانده نشده` : "همه اعلان‌ها خوانده شده"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            <MailOpen className="h-4 w-4 ml-2" />
            همه خوانده شد
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-muted-foreground">اعلانی وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => {
            const config = typeConfig[notification.type] || { label: notification.type, color: "text-gray-500" };
            return (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  !notification.isRead ? "border-primary/50 bg-primary/5" : ""
                }`}
                onClick={async () => {
                  if (await markAsRead(notification.id) && notification.link) {
                    window.location.href = notification.link;
                  }
                }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 ${config.color}`}>
                      {notification.type === "ALERT" ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : notification.type === "PAYMENT" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Bell className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${!notification.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                          {notification.title}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatPersianDateTime(notification.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                    >
                      {notification.isRead ? (
                        <MailOpen className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
