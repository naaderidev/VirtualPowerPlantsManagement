"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, Building2, Bell, Shield, Database, 
  Save, RefreshCw, Globe, Mail, Phone
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    companyName: "شرکت برقتو",
    companyAddress: "تهران، خیابان ولیعصر، پلاک ۱۲۳",
    companyPhone: "021-88012345",
    companyEmail: "info@beraguto.com",
    companyWebsite: "https://beraguto.com",
    defaultCurrency: "IRR",
    timezone: "Asia/Tehran",
    language: "fa",
    enableNotifications: true,
    enableSms: true,
    enableEmail: true,
    taxRate: 10,
    invoicePrefix: "INV",
    contractPrefix: "CTR",
    requestPrefix: "VPP",
  });

  const handleSave = () => {
    console.log("Settings saved:", settings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تنظیمات</h1>
          <p className="text-muted-foreground">تنظیمات سیستم و پیکربندی</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 ml-2" />
            بازنشانی
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 ml-2" />
            ذخیره تغییرات
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">عمومی</TabsTrigger>
          <TabsTrigger value="notifications">اعلان‌ها</TabsTrigger>
          <TabsTrigger value="invoice">صورتحساب</TabsTrigger>
          <TabsTrigger value="security">امنیت</TabsTrigger>
          <TabsTrigger value="database">پایگاه داده</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                اطلاعات شرکت
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>نام شرکت</Label>
                  <Input 
                    value={settings.companyName}
                    onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>وبسایت</Label>
                  <Input 
                    value={settings.companyWebsite}
                    onChange={(e) => setSettings({...settings, companyWebsite: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>آدرس</Label>
                <Textarea 
                  value={settings.companyAddress}
                  onChange={(e) => setSettings({...settings, companyAddress: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>تلفن</Label>
                  <Input 
                    value={settings.companyPhone}
                    onChange={(e) => setSettings({...settings, companyPhone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ایمیل</Label>
                  <Input 
                    type="email"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings({...settings, companyEmail: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                تنظیمات محلی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>واحد پول</Label>
                  <Select value={settings.defaultCurrency}>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IRR">ریال ایران</SelectItem>
                      <SelectItem value="IRR_TOMAN">تومان</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>منطقه زمانی</Label>
                  <Select value={settings.timezone}>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Tehran">تهران (GMT+3:30)</SelectItem>
                      <SelectItem value="Asia/Dubai">دبی (GMT+4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>زبان</Label>
                  <Select value={settings.language}>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fa">فارسی</SelectItem>
                      <SelectItem value="en">انگلیسی</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                تنظیمات اعلان‌ها
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">اعلان‌های ایمیلی</p>
                  <p className="text-sm text-muted-foreground">ارسال اعلان‌ها از طریق ایمیل</p>
                </div>
                <Switch 
                  checked={settings.enableEmail}
                  onCheckedChange={(checked) => setSettings({...settings, enableEmail: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">اعلان‌های پیامکی</p>
                  <p className="text-sm text-muted-foreground">ارسال اعلان‌ها از طریق پیامک</p>
                </div>
                <Switch 
                  checked={settings.enableSms}
                  onCheckedChange={(checked) => setSettings({...settings, enableSms: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">اعلان‌های درون برنامه‌ای</p>
                  <p className="text-sm text-muted-foreground">نمایش اعلان‌ها در برنامه</p>
                </div>
                <Switch 
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) => setSettings({...settings, enableNotifications: checked})}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                تنظیمات ایمیل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>SMTP Server</Label>
                  <Input placeholder="smtp.example.com" />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input placeholder="587" />
                </div>
                <div className="space-y-2">
                  <Label>نام کاربری</Label>
                  <Input placeholder="username" />
                </div>
                <div className="space-y-2">
                  <Label>رمز عبور</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
              </div>
              <Button variant="outline">
                <Mail className="h-4 w-4 ml-2" />
                تست ارسال ایمیل
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Settings */}
        <TabsContent value="invoice" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                تنظیمات صورتحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>پیشوند صورتحساب</Label>
                  <Input 
                    value={settings.invoicePrefix}
                    onChange={(e) => setSettings({...settings, invoicePrefix: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>پیشوند قرارداد</Label>
                  <Input 
                    value={settings.contractPrefix}
                    onChange={(e) => setSettings({...settings, contractPrefix: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>پیشوند درخواست</Label>
                  <Input 
                    value={settings.requestPrefix}
                    onChange={(e) => setSettings({...settings, requestPrefix: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>نرخ مالیات (%)</Label>
                <Input 
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({...settings, taxRate: parseInt(e.target.value)})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                تنظیمات امنیتی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">احراز هویت دو مرحله‌ای</p>
                  <p className="text-sm text-muted-foreground">فعال‌سازی احراز هویت دو مرحله‌ای برای کاربران</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">قفل حساب پس از تلاش‌های ناموفق</p>
                  <p className="text-sm text-muted-foreground">قفل حساب پس از ۵ بار تلاش ناموفق</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">انقضای رمز عبور</p>
                  <p className="text-sm text-muted-foreground">اجبار به تغییر رمز عبور هر ۹۰ روز</p>
                </div>
                <Switch />
              </div>
              <div className="space-y-2">
                <Label>حداقل طول رمز عبور</Label>
                <Input type="number" defaultValue={8} className="w-32" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Settings */}
        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                تنظیمات پایگاه داده
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">نوع پایگاه داده: MySQL</p>
                <p className="text-sm text-muted-foreground">وضعیت: متصل</p>
                <p className="text-sm text-muted-foreground">نسخه: 8.0</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>آدرس سرور</Label>
                  <Input defaultValue="localhost" disabled />
                </div>
                <div className="space-y-2">
                  <Label>پورت</Label>
                  <Input defaultValue="3306" disabled />
                </div>
                <div className="space-y-2">
                  <Label>نام پایگاه داده</Label>
                  <Input defaultValue="vpp" disabled />
                </div>
                <div className="space-y-2">
                  <Label>کاربر</Label>
                  <Input defaultValue="root" disabled />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Database className="h-4 w-4 ml-2" />
                  پشتیبان‌گیری
                </Button>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 ml-2" />
                  بازیابی پشتیبان
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
