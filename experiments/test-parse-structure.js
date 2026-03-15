import { Parser, Link } from '@linksplatform/protocols-lino';

const publicLog = {
  buildEntityLink(entity, data) {
    const values = [new Link(entity)];
    if (data.guid) values.push(new Link(String(data.guid)));
    if (data.userId) values.push(new Link(String(data.userId)));
    if (data.description !== undefined) values.push(new Link(String(data.description)));
    if (data.channelMessageId !== undefined && data.channelMessageId !== null) {
      values.push(new Link(String(data.channelMessageId)));
    }
    if (data.createdAt) values.push(new Link(String(data.createdAt)));
    return new Link(null, values);
  }
};

const empty = new Link(null, []);
const needData = publicLog.buildEntityLink('need', {
  guid: 'g1', userId: '123', description: 'Test need', 
  channelMessageId: 42, createdAt: '2025-10-12T00:00:00.000Z'
});

const creation = new Link(null, [empty, needData]);
console.log("Creation sub:", creation.toString());

const tx = new Link(null, [
  new Link('transaction'),
  new Link('tx-id'),
  new Link('2025-10-12T00:00:00.000Z'),
  creation
]);
const txStr = tx.toString();
console.log("Transaction:", txStr);

const parser = new Parser();
const parsed = parser.parse(txStr);
console.log("\nParsed structure:");
console.log(JSON.stringify(parsed, null, 2));

// Navigate: parsed[0] = the transaction link
const txLink = parsed[0];
console.log("\ntxLink.values count:", txLink.values.length);
for (let i = 0; i < txLink.values.length; i++) {
  const v = txLink.values[i];
  console.log(`  [${i}] id=${v.id}, values.length=${v.values.length}`);
  if (v.values.length > 0) {
    for (let j = 0; j < v.values.length; j++) {
      console.log(`    [${i}][${j}] id=${v.values[j].id}, values.length=${v.values[j].values.length}`);
    }
  }
}
