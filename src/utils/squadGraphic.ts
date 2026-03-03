import type { Match, MatchPlayer } from '../types';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

// SCC brand colors - Modern dark navy theme
const COLORS = {
  darkBg: '#0f172a',
  mediumBg: '#1e293b',
  accent: '#3b82f6',
  accentLight: '#60a5fa',
  accentGold: '#f59e0b',
  white: '#ffffff',
  lightText: '#cbd5e1',
  cardBg: 'rgba(255,255,255,0.08)',
  cardBorder: 'rgba(255,255,255,0.12)',
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number, cy: number, radius: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    // Fallback: gradient circle with initials
    const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    grad.addColorStop(0, COLORS.accent);
    grad.addColorStop(1, COLORS.darkBg);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.font = `bold ${radius * 0.9}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), cx, cy);
  }
  ctx.restore();

  // Draw border ring
  ctx.strokeStyle = COLORS.accentGold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.stroke();
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generateSquadGraphic(
  match: Match,
  logo?: HTMLImageElement | null
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // === Background gradient - Dark navy ===
  const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.4, '#1e293b');
  bgGrad.addColorStop(0.7, '#0f172a');
  bgGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle geometric pattern overlay
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < CANVAS_WIDTH; i += 60) {
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let j = 0; j < CANVAS_HEIGHT; j += 60) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(CANVAS_WIDTH, j);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Diagonal accent glow (top-right corner)
  const glowGrad = ctx.createRadialGradient(CANVAS_WIDTH - 100, 100, 0, CANVAS_WIDTH - 100, 100, 500);
  glowGrad.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // === Top accent bar - blue gradient ===
  const accentGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  accentGrad.addColorStop(0, COLORS.accent);
  accentGrad.addColorStop(0.5, COLORS.accentGold);
  accentGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 5);

  // === Logo + Club Name ===
  let headerY = 40;

  if (logo && logo.complete && logo.naturalWidth > 0) {
    const logoSize = 80;
    const logoX = (CANVAS_WIDTH - logoSize) / 2;
    // Draw circular logo
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, headerY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, logoX, headerY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = COLORS.accentGold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, headerY + logoSize / 2, logoSize / 2 + 1, 0, Math.PI * 2);
    ctx.stroke();
    headerY += logoSize + 12;
  }

  ctx.fillStyle = COLORS.accentGold;
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SANGRIA CRICKET CLUB', CANVAS_WIDTH / 2, headerY + 30);

  // === "MATCH DAY SQUAD" title ===
  headerY += 60;
  ctx.fillStyle = COLORS.lightText;
  ctx.font = '600 26px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('M A T C H   D A Y   S Q U A D', CANVAS_WIDTH / 2, headerY + 20);

  // Divider line
  headerY += 40;
  const divGrad = ctx.createLinearGradient(100, 0, CANVAS_WIDTH - 100, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.3, COLORS.accent);
  divGrad.addColorStop(0.7, COLORS.accent);
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, headerY);
  ctx.lineTo(CANVAS_WIDTH - 100, headerY);
  ctx.stroke();

  // === Match Info Card ===
  headerY += 20;
  const infoCardX = 60;
  const infoCardW = CANVAS_WIDTH - 120;
  const infoCardH = 120;

  ctx.fillStyle = COLORS.cardBg;
  drawRoundedRect(ctx, infoCardX, headerY, infoCardW, infoCardH, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.cardBorder;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, infoCardX, headerY, infoCardW, infoCardH, 16);
  ctx.stroke();

  // Match date
  const matchDate = new Date(match.date + 'T00:00:00');
  const dateStr = matchDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  ctx.fillStyle = COLORS.accentGold;
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`📅  ${dateStr}`, CANVAS_WIDTH / 2, headerY + 40);

  // Venue
  ctx.fillStyle = COLORS.lightText;
  ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`📍  ${match.venue}`, CANVAS_WIDTH / 2, headerY + 72);

  // Opponent
  if (match.opponent) {
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`vs ${match.opponent}`, CANVAS_WIDTH / 2, headerY + 104);
  }

  // === Players Grid ===
  headerY += infoCardH + 30;

  const players = match.players || [];
  const isInternal = match.match_type === 'internal';

  // Load player avatars
  const avatarPromises = players.map(async (p) => {
    if (p.member?.avatar_url) {
      return loadImage(p.member.avatar_url);
    }
    return null;
  });
  const avatarImages = await Promise.all(avatarPromises);

  if (isInternal) {
    // Split into two teams
    const teamA = players.filter(p => p.team === 'dhurandars');
    const teamB = players.filter(p => p.team === 'bazigars');

    const drawTeamColumn = async (
      teamPlayers: MatchPlayer[],
      teamName: string,
      startX: number,
      colWidth: number,
      avatars: (HTMLImageElement | null)[]
    ) => {
      let y = headerY;
      // Team name
      ctx.fillStyle = COLORS.accentGold;
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(teamName, startX + colWidth / 2, y);
      y += 10;

      // Underline
      ctx.strokeStyle = COLORS.accentGold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX + 30, y + 5);
      ctx.lineTo(startX + colWidth - 30, y + 5);
      ctx.stroke();
      y += 25;

      teamPlayers.forEach((player, idx) => {
        const name = player.member?.name || 'Unknown';
        const avatarIdx = players.indexOf(player);
        const avatar = avatarIdx >= 0 ? avatars[avatarIdx] : null;

        // Player row card
        ctx.fillStyle = COLORS.cardBg;
        drawRoundedRect(ctx, startX + 10, y, colWidth - 20, 56, 12);
        ctx.fill();

        // Number badge
        ctx.fillStyle = COLORS.accentGold;
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${idx + 1}`, startX + 35, y + 33);

        // Avatar
        drawCircleAvatar(ctx, avatar, name, startX + 70, y + 28, 18);

        // Name
        ctx.fillStyle = COLORS.white;
        ctx.font = '17px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'left';
        const maxNameWidth = colWidth - 120;
        let displayName = name;
        while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 0) {
          displayName = displayName.slice(0, -1);
        }
        if (displayName !== name) displayName += '..';
        ctx.fillText(displayName, startX + 98, y + 34);

        y += 62;
      });
    };

    const colWidth = (CANVAS_WIDTH - 80) / 2;
    // Get team-specific avatar arrays
    await drawTeamColumn(teamA, 'SANGRIA DHURANDARS', 40, colWidth, avatarImages);
    await drawTeamColumn(teamB, 'SANGRIA BAZIGARS', 40 + colWidth, colWidth, avatarImages);
  } else {
    // External match: single grid
    const cols = 2;
    const cardW = (CANVAS_WIDTH - 120) / cols;
    const cardH = 60;
    const startX = 60;
    let y = headerY;

    // "PLAYING XI" or squad count
    ctx.fillStyle = COLORS.accentGold;
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const squadLabel = players.length === 11 ? 'PLAYING XI' : `SQUAD (${players.length})`;
    ctx.fillText(squadLabel, CANVAS_WIDTH / 2, y);
    y += 15;

    // Underline
    const ulGrad = ctx.createLinearGradient(200, 0, CANVAS_WIDTH - 200, 0);
    ulGrad.addColorStop(0, 'transparent');
    ulGrad.addColorStop(0.3, COLORS.accentGold);
    ulGrad.addColorStop(0.7, COLORS.accentGold);
    ulGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = ulGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, y + 5);
    ctx.lineTo(CANVAS_WIDTH - 200, y + 5);
    ctx.stroke();
    y += 25;

    players.forEach((player, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const name = player.member?.name || 'Unknown';
      const avatar = avatarImages[idx];

      const cardX = startX + col * cardW;
      const cardY = y + row * (cardH + 8);

      // Card background
      ctx.fillStyle = COLORS.cardBg;
      drawRoundedRect(ctx, cardX, cardY, cardW - 12, cardH, 12);
      ctx.fill();

      // Number
      ctx.fillStyle = COLORS.accentGold;
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, cardX + 24, cardY + 35);

      // Avatar
      drawCircleAvatar(ctx, avatar, name, cardX + 60, cardY + 30, 20);

      // Name
      ctx.fillStyle = COLORS.white;
      ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      const maxNameW = cardW - 110;
      let displayName = name;
      while (ctx.measureText(displayName).width > maxNameW && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== name) displayName += '..';
      ctx.fillText(displayName, cardX + 90, cardY + 36);
    });
  }

  // === Footer ===
  const footerY = CANVAS_HEIGHT - 60;

  // Footer divider
  const footDivGrad = ctx.createLinearGradient(100, 0, CANVAS_WIDTH - 100, 0);
  footDivGrad.addColorStop(0, 'transparent');
  footDivGrad.addColorStop(0.3, COLORS.cardBorder);
  footDivGrad.addColorStop(0.7, COLORS.cardBorder);
  footDivGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = footDivGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, footerY - 10);
  ctx.lineTo(CANVAS_WIDTH - 100, footerY - 10);
  ctx.stroke();

  // Match fee info
  if (match.match_fee > 0) {
    ctx.fillStyle = COLORS.lightText;
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 Match Fee: ₹${match.match_fee}`, 60, footerY + 20);
  }

  // Bottom accent bar
  const bottomBarGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  bottomBarGrad.addColorStop(0, COLORS.accent);
  bottomBarGrad.addColorStop(0.5, COLORS.accentGold);
  bottomBarGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = bottomBarGrad;
  ctx.fillRect(0, CANVAS_HEIGHT - 5, CANVAS_WIDTH, 5);

  // Watermark
  ctx.fillStyle = COLORS.lightText;
  ctx.globalAlpha = 0.4;
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('sangriacricket.club', CANVAS_WIDTH - 60, footerY + 20);
  ctx.globalAlpha = 1;

  return canvas;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
