import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: deleteError } = await supabase
    .from("google_connections")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Google disconnect error:", deleteError);
    return NextResponse.json(
      { error: "Google bağlantısı kaldırılamadı" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
