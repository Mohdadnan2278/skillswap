import {z} from 'zod';
export const notificationSchema=z.object({id:z.string().uuid(),booking_id:z.string().uuid(),kind:z.enum(['pending','accepted','rejected','cancelled','expired','completed','disputed','confirmation']),created_at:z.string().datetime({offset:true}),read_at:z.string().datetime({offset:true}).nullable(),skill_name:z.string()});
export const inboxSchema=z.object({items:z.array(notificationSchema),unreadCount:z.number().int().nonnegative()});
export const readNotificationsSchema=z.object({ids:z.array(z.string().uuid()).max(50)}).strict();
export type BookingNotification=z.infer<typeof notificationSchema>;
export const notificationLabels:Record<BookingNotification['kind'],string>={pending:'New session request',accepted:'Your session was accepted',rejected:'Your request was declined',cancelled:'Session cancelled',expired:'Request expired',completed:'Session completed — credits transferred',disputed:'A session problem was reported',confirmation:'Your partner confirmed completion'};
