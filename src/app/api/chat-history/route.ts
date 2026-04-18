import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/services/db";
import type { AIResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Expected request body shape for creating a new chat history entry. */
interface CreateChatHistoryBody {
  prompt: string;
  response: AIResponse;
  conversationId?: string | null;
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/** GET /api/chat-history — Returns all chat history entries for the current user. */
export async function GET(req: NextRequest): Promise<NextResponse> {
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

/** POST /api/chat-history — Creates a new chat history entry for the current user. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CreateChatHistoryBody;
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
        response: response as unknown as any,
        conversationId: conversationId ?? null,
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
