import { handleAiAnalyze, type AiEnv } from '../../../../src/lib/ai/proxy';

type PagesContext = {
  request: Request;
  env?: AiEnv;
};

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export function onRequestPost(context: PagesContext) {
  return handleAiAnalyze(context.request, context.env);
}
