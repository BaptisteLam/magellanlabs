import { cn } from "@/lib/utils";
import { ChevronDown, FileCode } from "lucide-react";
import * as React from "react";

interface TaskProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Task({ children, className, ...props }: TaskProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children}
    </div>
  );
}

interface TaskTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  isOpen?: boolean;
}

export function TaskTrigger({ title, isOpen = true, className, ...props }: TaskTriggerProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors",
        className
      )}
      {...props}
    >
      <ChevronDown 
        className={cn(
          "h-4 w-4 transition-transform",
          isOpen ? "rotate-0" : "-rotate-90"
        )} 
      />
      {title}
    </button>
  );
}

interface TaskContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TaskContent({ children, className, ...props }: TaskContentProps) {
  return (
    <div className={cn("ml-6 space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

interface TaskItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TaskItem({ children, className, ...props }: TaskItemProps) {
  return (
    <div 
      className={cn(
        "text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2",
        className
      )} 
      {...props}
    >
      <span className="inline-block w-1 h-1 rounded-full bg-slate-400" />
      {children}
    </div>
  );
}

interface TaskItemFileProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function TaskItemFile({ children, className, ...props }: TaskItemFileProps) {
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs",
        className
      )} 
      {...props}
    >
      <FileCode className="h-3 w-3" />
      {children}
    </span>
  );
}
