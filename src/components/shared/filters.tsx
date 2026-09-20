"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "dateRange";
  options?: FilterOption[];
  placeholder?: string;
}

interface FiltersProps {
  fields: FilterField[];
  onFilter: (filters: Record<string, unknown>) => void;
  onReset?: () => void;
}

export function Filters({ fields, onFilter, onReset }: FiltersProps) {
  const [filters, setFilters] = useState<Record<string, unknown>>({});

  const handleChange = (key: string, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onReset?.();
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== "" && v !== null
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {fields.map((field) => {
          switch (field.type) {
            case "text":
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-sm">{field.label}</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={field.placeholder || "جستجو..."}
                      value={String(filters[field.key] || "")}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="pr-10 w-64"
                    />
                  </div>
                </div>
              );

            case "select":
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-sm">{field.label}</Label>
                  <SelectWithLabels
                    value={String(filters[field.key] || "")}
                    onValueChange={(value) => handleChange(field.key, value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={field.placeholder || "انتخاب کنید"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">همه</SelectItem>
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectWithLabels>
                </div>
              );

            case "date":
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-sm">{field.label}</Label>
                  <div className="w-48">
                    <PersianDatePicker
                      value={String(filters[field.key] || "")}
                      onChange={(value) => handleChange(field.key, value)}
                      placeholder={field.placeholder || "انتخاب تاریخ شمسی"}
                    />
                  </div>
                </div>
              );

            default:
              return null;
          }
        })}

        {hasActiveFilters && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-destructive"
            >
              <X className="h-4 w-4 ml-1" />
              پاک کردن فیلترها
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
