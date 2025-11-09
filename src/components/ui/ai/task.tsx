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
      "flex w-full items-center justify-between rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/30",
      "[&[data-state=open]>svg]:rotate-180",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2">
      {status === "complete" && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
      {status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {status === "pending" && <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/20 animate-pulse" />}
      <span className="text-foreground/90">{title}</span>
    </div>
    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200" />
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
    <div className="mt-1.5 space-y-1 px-3 py-2">
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
      "flex items-start gap-2 text-sm text-muted-foreground py-0.5",
      className
    )}
    {...props}
  >
    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
    <span className="flex-1 leading-relaxed">{children}</span>
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
      "inline-flex items-center gap-1.5 rounded bg-background/80 border border-border/40 px-2 py-0.5 font-mono text-xs text-foreground/80",
      className
    )}
    {...props}
  >
    {children}
  </span>
));
TaskItemFile.displayName = "TaskItemFile";

export { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile };
