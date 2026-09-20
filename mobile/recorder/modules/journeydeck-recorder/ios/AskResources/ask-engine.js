/* Shared, offline question engine. Executed unchanged in JavaScriptCore and Node tests.
 * No dynamic code, SQL generation, network, coordinates, identities, or question logging.
 * English prototype: accept only fully recognized questions; never silently ignore filters.
 */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const examples = ['How many miles did I drive this week?', 'When was my last journey?', 'What was my top artist this month?'];
  const reply = (status, text) => ({ status, text, evidence: [], context: null });
  function dateLabel(ms) { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function normalize(q) { return q.toLowerCase().replace(/[’']/g, '').replace(/[?.!,]+$/g, '').replace(/\s+/g, ' ').trim(); }
  function period(text, now) {
    const d = new Date(now), today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
    const week = new Date(today); week.setDate(today.getDate() - (today.getDay() + 6) % 7);
    const month = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const ranges = {
      today: [today.getTime(), endOfDay], yesterday: [new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime(), today.getTime()],
      'this week': [week.getTime(), now + 1], 'last week': [new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7).getTime(), week.getTime()],
      'this month': [month, now + 1], 'last month': [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), month],
      'this year': [new Date(d.getFullYear(), 0, 1).getTime(), now + 1],
      'last year': [new Date(d.getFullYear() - 1, 0, 1).getTime(), new Date(d.getFullYear(), 0, 1).getTime()],
      'all time': [0, now + 1], 'in total': [0, now + 1],
    };
    if (ranges[text]) return { start: ranges[text][0], end: ranges[text][1], label: text };
    const rolling = /^(?:in |over )?(?:the )?(?:last|past) (\d{1,3}) days$/.exec(text);
    if (rolling && Number(rolling[1]) > 0) return { start: now - Number(rolling[1]) * DAY, end: now + 1, label: `the last ${Number(rolling[1])} days` };
    const iso = /^on (\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (iso) {
      const y = Number(iso[1]), m = Number(iso[2]) - 1, day = Number(iso[3]);
      const start = new Date(y, m, day);
      if (start.getFullYear() === y && start.getMonth() === m && start.getDate() === day) return {
        start: start.getTime(), end: new Date(y, m, day + 1).getTime(), label: `on ${dateLabel(start.getTime())}`,
      };
    }
    return null;
  }
  const patterns = [
    ['miles', /^(?:how many miles (?:did i|have i) (?:drive|driven|travel|traveled)|how far (?:did i|have i) (?:drive|driven|travel|traveled)|(?:my |total )?miles)(.*)$/],
    ['journeyCount', /^(?:how many (?:journeys|trips|drives)(?: (?:did i|have i) (?:record|recorded|take|taken|complete|completed))?|(?:my |total )?(?:journey|trip|drive) count)(.*)$/],
    ['latestJourney', /^(?:(?:when was|what was|show|show me|tell me about) (?:my |the )?(?:last|latest|most recent) (?:journey|trip|drive))(.*)$/],
    ['longestJourney', /^(?:(?:what was|which was|show|show me) (?:my |the )?longest (?:journey|trip|drive))(.*)$/],
    ['firstJourney', /^(?:(?:when was|what was|show|show me) (?:my |the )?first (?:journey|trip|drive))(.*)$/],
    ['memoryCount', /^(?:how many memories(?: (?:did i|have i) (?:make|made|create|created|save|saved))?|(?:my |total )?memory count)(.*)$/],
    ['latestMemory', /^(?:(?:when was|what was|show|show me) (?:my |the )?(?:last|latest|most recent) memory)(.*)$/],
    ['songCount', /^(?:how many (?:songs|tracks)(?: (?:did i|have i) (?:hear|heard|play|played|listen to|listened to))?|(?:my |total )?(?:song|track) count)(.*)$/],
    ['topArtist', /^(?:(?:who was|what was|who is|what is|show|show me) (?:my |the )?(?:top|most played|most listened to) artist|(?:my )?top artist)(.*)$/],
    ['topSong', /^(?:(?:what was|what is|show|show me) (?:my |the )?(?:top|most played) (?:song|track)|(?:my )?top song)(.*)$/],
  ];
  function plan(question, input, previous) {
    if (typeof question !== 'string' || question.length > 500 || !question.trim()) return null;
    let q = normalize(question).replace(/^please /, '');
    const old = previous && previous.version === 1 && previous.expiresAt > input.now ? previous : null;
    let inherit = false;
    if (/^(and |what about |how about )/.test(q)) {
      if (!old) return null;
      inherit = true;
      q = q.replace(/^(and |what about |how about )/, '');
      const range = period(q, input.now);
      if (range) return { metric: old.metric, range };
    }
    if (/ (?:was that|were those|in that period|during that period)$/.test(q)) {
      if (!old) return null;
      inherit = true; q = q.replace(/ (?:was that|were those|in that period|during that period)$/, '');
    }
    for (const [metric, regex] of patterns) {
      const match = regex.exec(q);
      if (!match) continue;
      const suffix = match[1].trim();
      const range = suffix ? period(suffix, input.now) : inherit ? old.range : {
        start: input.cutoff, end: input.now + 1, label: 'in your available history',
      };
      return range ? { metric, range } : null;
    }
    return null;
  }
  function safeName(value, labels) {
    if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\r\n\x00-\x1f]|https?:|file:|@|\d{1,3}\.\d{3,}|\d+\s+\S+\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|way)\b/i.test(value)) return 'a private music title';
    const lower = value.toLowerCase();
    if (labels.some(label => label && lower.includes(label.toLowerCase()))) return 'a private music title';
    return value.trim();
  }
  function answer(question, input, previous) {
    const p = plan(question, input, previous);
    if (!p) return reply('clarify', 'Try one question about journey miles, journey dates or counts, Memories created, song plays, or your top artist. Use today, yesterday, this week, last week, this month, last month, or on YYYY-MM-DD. For a follow-up, ask “And how many journeys was that?”');
    if (p.range.start < input.cutoff) return reply('historyLimited', `That period includes history outside your current access. Ask about a period beginning ${dateLabel(input.cutoff + DAY)} or later.`);
    if (p.range.start > input.now) return reply('clarify', 'Choose a date in your recorded history.');
    if (['journeys', 'memories', 'music', 'sensitiveLabels'].some(key => input[key].length > 20000)) return reply('unavailable', 'This library is too large for the question prototype. Open JourneyDeck to explore it.');
    const inside = value => { const ms = Date.parse(value); return Number.isFinite(ms) && ms >= p.range.start && ms < p.range.end && ms <= input.now; };
    const journeys = input.journeys.filter(j => inside(j.startedAt));
    const memories = input.memories.filter(m => inside(m.createdAt));
    const music = input.music.filter(m => inside(m.playedAt));
    const distanceRows = ['songCount', 'topArtist', 'topSong'].includes(p.metric) ? input.journeys : journeys;
    if (!['memoryCount', 'latestMemory'].includes(p.metric) && distanceRows.some(j => typeof j.miles !== 'number' || !Number.isFinite(j.miles) || j.miles < 0)) {
      return reply('unavailable', 'Some saved distances could not be read reliably. Open JourneyDeck to review your library.');
    }
    const suffix = `${p.range.label}. Completed journeys saved on this device only.`;
    const jEvidence = j => ({ kind: 'journey', id: j.id, label: `Journey on ${dateLabel(Date.parse(j.startedAt))} · ${Number(j.miles).toFixed(1)} mi` });
    const context = { version: 1, metric: p.metric, range: p.range, expiresAt: input.now + 300000 };
    let text, evidence = [];
    if (p.metric === 'miles') {
      text = `You recorded ${journeys.reduce((sum, j) => sum + Number(j.miles), 0).toFixed(1)} miles across ${journeys.length} journeys ${suffix}`;
      evidence = journeys.slice(0, 5).map(jEvidence);
    } else if (p.metric === 'journeyCount') {
      text = `You recorded ${journeys.length} ${journeys.length === 1 ? 'journey' : 'journeys'} ${suffix}`;
      evidence = journeys.slice(0, 5).map(jEvidence);
    } else if (['latestJourney', 'firstJourney', 'longestJourney'].includes(p.metric)) {
      const sorted = [...journeys].sort((a, b) => p.metric === 'longestJourney' ? Number(b.miles) - Number(a.miles) || a.id.localeCompare(b.id) : (Date.parse(a.startedAt) - Date.parse(b.startedAt)) * (p.metric === 'firstJourney' ? 1 : -1) || a.id.localeCompare(b.id));
      const j = sorted[0];
      text = j ? `Your ${p.metric === 'firstJourney' ? 'first' : p.metric === 'longestJourney' ? 'longest' : 'latest'} journey ${p.range.label} started ${dateLabel(Date.parse(j.startedAt))} and covered ${Number(j.miles).toFixed(1)} miles.` : `No completed journeys are saved ${p.range.label}.`;
      evidence = j ? [jEvidence(j)] : [];
    } else if (p.metric === 'memoryCount' || p.metric === 'latestMemory') {
      const m = [...memories].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))[0];
      text = p.metric === 'memoryCount' ? `You created ${memories.length} ${memories.length === 1 ? 'Memory' : 'Memories'} ${p.range.label}.` : m ? `Your latest Memory ${p.range.label} was created ${dateLabel(Date.parse(m.createdAt))}.` : `No Memories were created ${p.range.label}.`;
      evidence = (p.metric === 'memoryCount' ? memories.slice(0, 5) : m ? [m] : []).map(m => ({ kind: 'memory', id: m.id, label: `Memory created ${dateLabel(Date.parse(m.createdAt))}` }));
    } else if (p.metric === 'songCount') {
      text = `Your completed journeys include ${music.length} recorded song plays ${p.range.label}. Repeat plays count separately; unrecorded listening is unknown.`;
      const ids = new Set(music.map(m => m.journeyId)); evidence = input.journeys.filter(j => ids.has(j.id)).slice(0, 5).map(jEvidence);
    } else {
      const groups = new Map();
      for (const m of music) {
        const key = p.metric === 'topArtist' ? m.artist.trim().toLowerCase() : JSON.stringify([m.track.trim().toLowerCase(), m.artist.trim().toLowerCase()]);
        if (!key || !m.artist.trim() || (p.metric === 'topSong' && !m.track.trim())) continue;
        const group = groups.get(key) || { key, count: 0, entry: m }; group.count++; groups.set(key, group);
      }
      const ranked = [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
      const best = ranked[0];
      if (!best) text = `No recorded ${p.metric === 'topArtist' ? 'artist' : 'song and artist'} metadata is available ${p.range.label}.`;
      else {
        const labels = input.sensitiveLabels.map(l => l.label);
        const name = p.metric === 'topArtist' ? safeName(best.entry.artist, labels) : `${safeName(best.entry.track, labels)} by ${safeName(best.entry.artist, labels)}`;
        const ties = ranked.filter(g => g.count === best.count).length;
        text = `${name} ${ties > 1 ? `is tied for the top spot with ${ties - 1} other ${p.metric === 'topArtist' ? 'artists' : 'songs'}` : 'is your top ' + (p.metric === 'topArtist' ? 'artist' : 'song')} with ${best.count} recorded song plays ${p.range.label}.`;
        const ids = new Set(music.filter(m => p.metric === 'topArtist' ? m.artist.trim().toLowerCase() === best.key : JSON.stringify([m.track.trim().toLowerCase(), m.artist.trim().toLowerCase()]) === best.key).map(m => m.journeyId));
        evidence = input.journeys.filter(j => ids.has(j.id)).slice(0, 5).map(jEvidence);
      }
    }
    return { status: 'answered', text, evidence, context };
  }
  const api = { answer, plan, examples };
  if (typeof module !== 'undefined') module.exports = api;
  root.JourneyDeckAskEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
