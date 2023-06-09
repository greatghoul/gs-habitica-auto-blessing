// https://habitica.com/apidoc/

const USER_ID = '<your id>';
const USER_TOKEN = '<your token>';
const SCRIPT_NAME = 'Habitica - Auto Healing';

const HEADERS = {
  'x-client': USER_ID + ' - ' + SCRIPT_NAME,
  'x-api-user': USER_ID,
  'x-api-key': USER_TOKEN
};

const LOW_HP = 35;

let castsCount = 0;

function formatHP(hp) {
  if (hp < 10) {
    return `0${hp}/50`;
  } else {
    return `${hp}/50`;
  }
}

function formatMember(member, hpFinal = -1) {
  if (hpFinal == -1) {
    return `- ${formatHP(member.hp)} : ${member.name}`;
  } else {
    return `- ${formatHP(member.hp)} -> ${formatHP(hpFinal)} : ${member.name}`;
  }
}

function getWeakMembers() {
  const resp = UrlFetchApp.fetch(`https://habitica.com/api/v3/groups/party/members?includeAllPublicFields=true`, { headers: HEADERS });
  const data = JSON.parse(resp.getContentText()).data;
  const members = [];
  data.forEach(x => {
    if (x.stats.hp < 50) {
      members.push({ id: x.id, name: x.profile.name, hp: parseInt(x.stats.hp) });
    }
  });
  members.sort((a, b) => a.hp - b.hp);

  // If any mmeber in low hp, treat the whole party as weak.
  if (members.find(x => x.hp < LOW_HP)) {
    return members;
  } else {
    return [];
  }
}

function makeHealthReport(members) {
  const result = [
    '### WEAK MEMBERS',
    '-----',
    ...members.map(x => formatMember(x)),
  ];
  return result.join('\n');
}

function makeHealingReport(membersStart, membersFinal) {
  const result = [
    '### Blessing Result',
    '-----',
  ];

  membersStart.forEach(a => {
    let hpFinal = 50;
    const b = membersFinal.find(x => x.id == a.id);
    if (b) {
      hpFinal = b.hp;
    }

    result.push(formatMember(a, hpFinal));
  });

  return result.join('\n');  
}

function postChatMessage(message) {
  const resp = UrlFetchApp.fetch('https://habitica.com/api/v3/groups/party/chat', {
    method: 'POST',
    headers: HEADERS,
    payload: { message }
  });
  Logger.log('Message sent.');
}

function castHealing() {
  try {
    const resp = UrlFetchApp.fetch('https://habitica.com/api/v3/user/class/cast/healAll', {
      method: 'POST',
      headers: HEADERS,
    });
    castsCount += 1;
    Logger.log("Cast blessing succeed.")
    return true;
  } catch (e) {
    Logger.log("Cast blessing failed: " + e.message);
    return false;
  }
}

function startHealing() {
  const result = castHealing();
  if (result && getWeakMembers().length > 0) {
    startHealing();
  } else {
    Logger.log('Finished healing.');
  }
}

function main() {
  const membersStart = getWeakMembers();
  Logger.log(makeHealthReport(membersStart));

  if (membersStart.length) {
    startHealing();
  }

  if (castsCount > 0) {
    const membersFinal = getWeakMembers();
    const healingReport = makeHealingReport(membersStart, membersFinal);
    Logger.log(healingReport);
    postChatMessage(healingReport);
  }
}
