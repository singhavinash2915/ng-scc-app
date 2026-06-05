/**
 * Payment-screenshot auto-validator
 *
 * POST body: { screenshotUrl: string, expectedAmount: number, expectedUpiId: string }
 *
 * Workflow:
 *   1. Download the screenshot from Supabase storage URL
 *   2. Send to Claude Vision API → extract amount, UPI ID, status, txn ID
 *   3. Compare extracted values against expected → return verdict
 *
 * Verdict:
 *   - "verified"        — amount + UPI match + status = success/paid
 *   - "needs_review"    — looks like a payment but one or more checks failed
 *   - "rejected"        — not a payment screenshot, or status = failed
 */

import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedPaymentInfo {
  is_payment_screenshot: boolean;
  app_name: string | null;       // 'PhonePe', 'GPay', 'Paytm', 'BHIM', etc.
  status_text: string | null;    // 'Success', 'Failed', 'Pending', etc.
  amount: number | null;
  recipient_upi_id: string | null;
  recipient_name: string | null;
  txn_id: string | null;
  txn_date: string | null;       // ISO if extractable
  looks_edited: boolean;         // signs of tampering
  confidence: number;            // 0..1 — how sure Claude is about the above
  notes: string;                 // free-text observations
}

function normUpi(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s+/g, '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({
        verdict: 'needs_review',
        reason: 'AI not configured — admin will verify manually',
        extracted: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { screenshotUrl, expectedAmount, expectedUpiId } = await req.json();

    if (!screenshotUrl || !expectedAmount || !expectedUpiId) {
      return new Response(JSON.stringify({ error: 'screenshotUrl, expectedAmount, expectedUpiId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Download screenshot and convert to base64 for Claude Vision
    const imgRes = await fetch(screenshotUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch screenshot: HTTP ${imgRes.status}`);

    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const imgBuf = await imgRes.arrayBuffer();
    // Base64 encode (Deno-compatible)
    const bytes = new Uint8Array(imgBuf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // 2. Ask Claude Vision to extract structured payment info
    const client = new Anthropic({ apiKey });
    const prompt = `You are analysing a UPI payment screenshot. Extract the following fields. Reply with ONLY valid JSON, no markdown fences, no commentary.

Required fields:
- is_payment_screenshot (boolean): is this an Indian UPI/payment app screenshot at all?
- app_name (string|null): PhonePe / Google Pay / Paytm / BHIM / Amazon Pay / etc.
- status_text (string|null): the literal status text shown, e.g. "Success", "Payment Successful", "Failed", "Pending"
- amount (number|null): the ₹ amount sent (just the integer, no rupee symbol)
- recipient_upi_id (string|null): the UPI ID that received the money (looks like xxx@bankcode)
- recipient_name (string|null): name of the person/entity that received the money
- txn_id (string|null): transaction ID / UPI reference number
- txn_date (string|null): payment date in YYYY-MM-DD format if visible
- looks_edited (boolean): are there any signs of photoshop, font mismatch, alignment issues, suspicious overlays?
- confidence (number): your overall confidence in the above extractions, 0 to 1
- notes (string): any concerns or observations, ≤ 50 words

If the image is not a payment screenshot at all, set is_payment_screenshot=false and leave other fields null.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    // Strip code fences if model added them despite instructions
    const cleanJson = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let extracted: ExtractedPaymentInfo;
    try {
      extracted = JSON.parse(cleanJson);
    } catch {
      return new Response(JSON.stringify({
        verdict: 'needs_review',
        reason: 'Could not parse AI response — admin will verify manually',
        extracted: { raw: responseText },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Compare against expected values → verdict
    const reasons: string[] = [];

    if (!extracted.is_payment_screenshot) {
      return new Response(JSON.stringify({
        verdict: 'rejected',
        reason: 'Uploaded image is not a payment screenshot',
        extracted,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const statusOk = !!extracted.status_text &&
      /success|paid|complet|sent|debited/i.test(extracted.status_text);
    if (!statusOk) reasons.push(`Status "${extracted.status_text}" doesn't look like a successful payment`);

    const amountOk = extracted.amount === expectedAmount;
    if (!amountOk) reasons.push(`Amount mismatch (expected ₹${expectedAmount}, got ₹${extracted.amount ?? '?'})`);

    const upiOk = normUpi(extracted.recipient_upi_id) === normUpi(expectedUpiId);
    if (!upiOk) reasons.push(`UPI ID mismatch (expected ${expectedUpiId}, got ${extracted.recipient_upi_id ?? '?'})`);

    if (extracted.looks_edited) reasons.push('Possible tampering detected');
    if (extracted.confidence < 0.6) reasons.push(`Low confidence (${(extracted.confidence * 100).toFixed(0)}%)`);

    let verdict: 'verified' | 'needs_review' | 'rejected';
    if (extracted.status_text && /fail|reject|declined/i.test(extracted.status_text)) {
      verdict = 'rejected';
    } else if (statusOk && amountOk && upiOk && !extracted.looks_edited && extracted.confidence >= 0.6) {
      verdict = 'verified';
    } else {
      verdict = 'needs_review';
    }

    return new Response(JSON.stringify({
      verdict,
      reason: reasons.length ? reasons.join('; ') : 'All checks passed',
      extracted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({
      verdict: 'needs_review',
      reason: `Validation error: ${err instanceof Error ? err.message : String(err)} — admin will verify manually`,
      extracted: null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
