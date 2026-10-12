const test=require('node:test'),assert=require('node:assert/strict');
const {fromLocations}=require('../suite/biz-native-context.js');
test('one explicit project shared by circuit locations',()=>assert.deepEqual(fromLocations([{xpaceUrl:'https://www.admira.store/admira-xp/?project=starbucks'},{xpaceUrl:'https://www.admira.store/admira-xp/?project=starbucks&loc=two'}]),{project:'starbucks'}));
test('mixed circuit cannot choose a global substitute',()=>assert.deepEqual(fromLocations([{xpaceUrl:'https://www.admira.store/?project=a'},{xpaceUrl:'https://www.admira.store/?project=b'}]),{}));
test('invalid or unspecified project remains unselected',()=>assert.deepEqual(fromLocations([{xpaceUrl:'javascript:foo'},{xpaceUrl:'https://www.admira.store/?project=general'},{xpaceUrl:'https://www.admira.store/?project=bad%20name'}]),{}));
