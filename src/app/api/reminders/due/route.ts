import { requireApiUser, unauthorized } from "@/lib/api";
import { checkReminders } from "@/lib/reminders/check-reminders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorized();

    const result = await checkReminders(user.id);
    return Response.json(result);
  } catch {
    return Response.json({ message: "Hatırlatma kontrolü yapılamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
