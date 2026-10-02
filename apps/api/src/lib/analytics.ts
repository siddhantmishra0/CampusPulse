import { prisma } from './prisma';

type SentimentKey = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED';

/** Helper to apply optional date range filtering on a Prisma query */
function applyDateRange(where: any, start?: string, end?: string, dateField = 'createdAt') {
  if (start) {
    const startDate = new Date(start);
    where[dateField] = { ...(where[dateField] || {}), gte: startDate };
  }
  if (end) {
    const endDate = new Date(end);
    where[dateField] = { ...(where[dateField] || {}), lte: endDate };
  }
  return where;
}

/** Sentiment summary counts with optional date range */
export async function getSentimentSummary(campaignId: string, start?: string, end?: string) {
  const where: any = { submission: { campaignId } };
  applyDateRange(where, start, end, 'submission.submittedAt');
  const counts = await prisma.feedbackAnalysis.groupBy({
    by: ['sentiment'],
    where,
    _count: { sentiment: true },
  });
  const sentiments: Record<SentimentKey, number> = {
    POSITIVE: 0,
    NEUTRAL: 0,
    NEGATIVE: 0,
    MIXED: 0,
  };
  counts.forEach((c: { sentiment: string; _count: { sentiment: number } }) => {
    sentiments[c.sentiment as SentimentKey] = Number(c._count.sentiment);
  });
  return sentiments;
}

/** Top topics ordered by confidence with optional date range */
export async function getTopTopics(
  campaignId: string,
  limit = 10,
  start?: string,
  end?: string,
) {
  const where: any = { analysis: { submission: { campaignId } } };
  applyDateRange(where, start, end, 'analysis.analyzedAt');
  const topics = await prisma.feedbackTopic.findMany({
    where,
    orderBy: { confidence: 'desc' },
    take: limit,
  });
  return topics.map((t: { name: string; confidence: number }) => ({ name: t.name, confidence: t.confidence }));
}

/** Issue summary counts by category with optional date range */
export async function getIssueSummary(campaignId: string, start?: string, end?: string) {
  const where: any = { analysis: { submission: { campaignId } } };
  applyDateRange(where, start, end, 'analysis.analyzedAt');
  const result = await prisma.feedbackIssue.groupBy({
    by: ['category'],
    where,
    _count: { category: true },
  });
  return result.reduce((acc: Record<string, number>, cur: { category: string; _count: { category: number } }) => {
    acc[cur.category] = cur._count.category;
    return acc;
  }, {} as Record<string, number>);
}

/** Overall summary including latest text summary, supports date range */
export async function getOverallSummary(campaignId: string, start?: string, end?: string) {
  const [sentiment, topics, issues] = await Promise.all([
    getSentimentSummary(campaignId, start, end),
    getTopTopics(campaignId, 5, start, end),
    getIssueSummary(campaignId, start, end),
  ]);
  const latest = await prisma.feedbackAnalysis.findFirst({
    where: { submission: { campaignId } },
    orderBy: { analyzedAt: 'desc' },
    select: { summary: true },
  });
  return {
    sentiment,
    topTopics: topics,
    issueCounts: issues,
    latestSummary: latest?.summary ?? null,
  };
}

/** Export aggregated analytics as CSV or JSON */
export async function exportAnalytics(
  campaignId: string,
  format: 'csv' | 'json',
  start?: string,
  end?: string,
) {
  const data = await getOverallSummary(campaignId, start, end);
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  // Simple CSV flattening
  const rows: string[] = [];
  rows.push('section,key,value');
  Object.entries(data.sentiment).forEach(([sent, count]) => {
    rows.push(`sentiment,${sent},${count}`);
  });
  data.topTopics.forEach((t: { name: string; confidence: number }) => {
    rows.push(`topic,${t.name},${t.confidence}`);
  });
  Object.entries(data.issueCounts).forEach(([cat, cnt]) => {
    rows.push(`issue,${cat},${cnt}`);
  });
  rows.push(`summary,latest,${(data.latestSummary || '').replace(/\n/g, ' ')}`);
  return rows.join('\n');
}
