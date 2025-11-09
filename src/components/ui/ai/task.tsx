import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Task = CollapsiblePrimitive.Root;

interface TaskTriggerProps extends React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> {
  title: string;
  status?: "pending" | "running" | "complete";
}

const TaskTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  TaskTriggerProps
>(({ className, title, status = "running", ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium transition-all hover:bg-accent/50",
      "[&[data-state=open]>svg]:rotate-180",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2">
      {status === "complete" && <Check className="h-4 w-4 text-green-500" />}
      {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      {status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
      <span>{title}</span>
    </div>
    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
  </CollapsiblePrimitive.Trigger>
));
TaskTrigger.displayName = "TaskTrigger";

const TaskContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
      className
    )}
    {...props}
  >
    <div className="mt-2 space-y-1 rounded-lg border border-border bg-card/50 p-3">
      {children}
    </div>
  </CollapsiblePrimitive.Content>
));
TaskContent.displayName = "TaskContent";

const TaskItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-start gap-2 text-sm text-muted-foreground",
      className
    )}
    {...props}
  >
    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
    <span className="flex-1">{children}</span>
  </div>
));
TaskItem.displayName = "TaskItem";

const TaskItemFile = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs",
      className
    )}
    {...props}
  >
    {children}
  </span>
));
TaskItemFile.displayName = "TaskItemFile";

export { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile };
