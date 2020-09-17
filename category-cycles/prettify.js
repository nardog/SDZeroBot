const {bot, log} = require('../botbase');

const PAGE_SIZE_MAX_LIMIT = 60000;

process.chdir(__dirname);

// sort cycles by length as we're more interested in the smaller cycles
let cycles = require('./cycles.json').sort((a, b) => a.length - b.length);

(async function() {

await bot.getTokensAndSiteInfo();

let map = {};

for (let cycle of cycles) {
	cycle.reverse(); // while we're iterating, reverse the cycle in-place to get a more logical order
	for (let pgid of cycle) {
		map[pgid] = '';
	}
}

log(`[+] Detected ${cycles.length} category cycles involving a total of ${Object.keys(map).length} unique categories. Showing first 5000 lines of output...

LEGEND:
"Foo -> Bar" indicates that Category:Foo contains Category:Bar

`);

// Resolve titles from page IDs, 500 at a time
for await (let json of bot.massQueryGen({
	action: 'query',
	pageids: Object.keys(map)
}, 'pageids')) {

	for (let pg of json.query.pages) {
		map[pg.pageid] = pg.title.slice('Category:'.length);
	}

}

let page_number = 1;
let page = 0;
let wiki_page_name = num => `User:SDZeroBot/Category cycles/${num}`

for (let cycle of cycles) {
	page += '*' + cycle.map(e => `[[:Category:${map[e]}|${map[e]}]]`).join(' -> ') + '\n';
	if (page.length > PAGE_SIZE_MAX_LIMIT) {
		await bot.save(wiki_page_name(page_number), page)
			.then(() => log(`[+] Saved ${wiki_page_name(page_number)}`));
		page_number++;
		page = '';
		if (page_number > 100) {
			break;
		}
	}
}
log(`[i] Finished`);

})();