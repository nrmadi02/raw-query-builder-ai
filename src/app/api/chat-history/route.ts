import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/services/db";

// GET /api/chat-history - Get all chat history for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatHistory = await prisma.chatHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(chatHistory);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history" },
      { status: 500 },
    );
  }
}

// POST /api/chat-history - Create new chat history entry
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, response, conversationId } = body;

    if (!prompt || !response) {
      return NextResponse.json(
        { error: "Prompt and response are required" },
        { status: 400 },
      );
    }

    const chatHistory = await prisma.chatHistory.create({
      data: {
        userId: session.user.id,
        prompt,
        response,
        conversationId: conversationId || null,
      },
    });

    return NextResponse.json(chatHistory, { status: 201 });
  } catch (error) {
    console.error("Error creating chat history:", error);
    return NextResponse.json(
      { error: "Failed to create chat history" },
      { status: 500 },
    );
  }
}
