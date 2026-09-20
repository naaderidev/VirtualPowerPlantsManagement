"use client";

import { formatPersianDateTime } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCircle2,
  AlertTriangle, Mail, MailOpen, Loader2
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
  PAYMENT: { label: "پرداخت", color: "text-green-500" },
  METERING: { label: "اندازه‌گیری", color: "text-yellow-500" },
  REQUEST: { label: "درخواست", color: "text-purple-500" },
  CONTRACT: { label: "قرارداد", color: "text-primary" },
  SETTLEMENT: { label: "تسویه", color: "text-orange-500" },
  ALERT: { label: "هشدار", color: "text-destructive" },
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
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

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      console.error("خطا در بروزرسانی اعلان");
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      console.error("خطا در بروزرسانی اعلان‌ها");
    }
  };

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            همه
            <Badge variant="secondary" className="mr-2">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread">
            خوانده نشده
            {unreadCount > 0 && (
              <Badge variant="destructive" className="mr-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All Tab */}
        <TabsContent value="all" className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className=" text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">اعلانی وجود ندارد</p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => {
              const config = typeConfig[notification.type] || { label: notification.type, color: "text-gray-500" };
              return (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    !notification.isRead ? "border-primary/50 bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.link) window.location.href = notification.link;
                  }}
                >
                  <CardContent className="">
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
        </TabsContent>

        {/* Unread Tab */}
        <TabsContent value="unread" className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className=" text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">همه اعلان‌ها خوانده شده</p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => {
              const config = typeConfig[notification.type] || { label: notification.type, color: "text-gray-500" };
              return (
                <Card
                  key={notification.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50 border-primary/50 bg-primary/5"
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.link) window.location.href = notification.link;
                  }}
                >
                  <CardContent className="">
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
                          <p className="font-medium">{notification.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatPersianDateTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
