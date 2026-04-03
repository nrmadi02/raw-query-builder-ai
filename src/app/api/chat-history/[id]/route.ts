import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/services/db";

// DELETE /api/chat-history/[id] - Delete a specific chat history entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the chat history belongs to the current user
    const chatHistory = await prisma.chatHistory.findUnique({
      where: { id },
    });

    if (!chatHistory) {
      return NextResponse.json(
        { error: "Chat history not found" },
        { status: 404 },
      );
    }

    if (chatHistory.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.chatHistory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat history:", error);
    return NextResponse.json(
      { error: "Failed to delete chat history" },
      { status: 500 },
    );
  }
}
