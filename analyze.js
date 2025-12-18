const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_FILE = 'share-projects.html';
const OUTPUT_DIR = 'litematic-context';
const WINDOW = 20; // messages before and after

function readHtml(file) {
  return fs.readFileSync(file, 'utf8');
}

function buildPrefixAndSuffix(html) {
  const chatlogStart = html.indexOf('<div class="chatlog">');
  if (chatlogStart === -1) {
    throw new Error('Could not find chatlog start in HTML.');
  }

  const chatlogOpenEnd = chatlogStart + '<div class="chatlog">'.length;
  const postambleIndex = html.indexOf('<div class=postamble');
  const chatlogEnd = postambleIndex === -1 ? html.length : postambleIndex;

  const prefix = html.slice(0, chatlogOpenEnd);
  const suffix = '</div>' + html.slice(chatlogEnd); // close chatlog then append tail

  return { prefix, suffix, chatlogOpenEnd, chatlogEnd };
}

function extractMessages(html, startSearchAt, chatlogEnd) {
  const token = '<div id=chatlog__message-container-';
  const starts = [];
  let idx = html.indexOf(token, startSearchAt);
  while (idx !== -1) {
    starts.push(idx);
    idx = html.indexOf(token, idx + token.length);
  }

  if (starts.length === 0) {
    throw new Error('No messages found in the export.');
  }

  return starts.map((pos, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : chatlogEnd;
    const snippet = html.slice(pos, end);
    const idMatch = snippet.match(/id=chatlog__message-container-([0-9]+)/);
    const id = idMatch ? idMatch[1] : `unknown-${i}`;
    const hasGroupOpen = snippet.includes('chatlog__message-group');
    const hasLitematic = snippet.toLowerCase().includes('.litematic');
    return { pos, end, snippet, id, hasGroupOpen, hasLitematic };
  });
}

function windowForMessage(messages, targetIndex, chatlogEnd) {
  let start = Math.max(0, targetIndex - WINDOW);
  let end = Math.min(messages.length - 1, targetIndex + WINDOW);

  // Ensure we include the start of the message group for a clean snippet
  while (start > 0 && !messages[start].hasGroupOpen) {
    start -= 1;
  }

  const sliceStart = messages[start].pos;
  const sliceEnd = end + 1 < messages.length ? messages[end + 1].pos : chatlogEnd;
  return { sliceStart, sliceEnd, start, end };
}

function writeContextFile({ prefix, suffix, html, matchId, sliceStart, sliceEnd, index }) {
  const dir = path.join(process.cwd(), OUTPUT_DIR);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `context-${index + 1}-${matchId}.html`;
  const outputPath = path.join(dir, filename);

  const body = html.slice(sliceStart, sliceEnd);
  const full = `${prefix}${body}${suffix}`;
  fs.writeFileSync(outputPath, full, 'utf8');
  return outputPath;
}

function main() {
  const html = readHtml(SOURCE_FILE);
  const { prefix, suffix, chatlogOpenEnd, chatlogEnd } = buildPrefixAndSuffix(html);
  const messages = extractMessages(html, chatlogOpenEnd, chatlogEnd);
  const matches = messages
    .map((msg, index) => ({ ...msg, index }))
    .filter((msg) => msg.hasLitematic);

  if (matches.length === 0) {
    console.log('No .litematic attachments found.');
    return;
  }

  matches.forEach((match, i) => {
    const { sliceStart, sliceEnd, start, end } = windowForMessage(messages, match.index, chatlogEnd);
    const outputPath = writeContextFile({
      prefix,
      suffix,
      html,
      matchId: match.id,
      sliceStart,
      sliceEnd,
      index: i,
    });
    console.log(
      `Saved ${outputPath} (messages ${start + 1}-${end + 1} of ${messages.length}, target id ${match.id})`,
    );
  });
}

main();
