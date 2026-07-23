export {
  createNotification,
  markAsRead,
  listNotificationsForUser,
  countUnreadForUser,
  type CreateNotificationInput,
  type NotificationDto,
} from "@/lib/notifications/notification-service";

export {
  sendWebhookAlert,
  type WebhookPlatform,
  type WebhookDispatchResult,
} from "@/lib/notifications/webhook-service";
