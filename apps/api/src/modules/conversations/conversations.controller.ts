import { Request, Response, NextFunction } from 'express';
import * as conversationsService from './conversations.service';

export async function startConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { submissionToken } = req.body as { submissionToken: string };
    const result = await conversationsService.startConversation(submissionToken);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { content } = req.body as { content: string };
    const result = await conversationsService.sendMessage(id, content);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function submitConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { submissionToken, finalNote } = req.body as {
      submissionToken: string;
      finalNote?: string;
    };
    const result = await conversationsService.submitConversation(id, submissionToken, finalNote);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const result = await conversationsService.getConversation(id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
