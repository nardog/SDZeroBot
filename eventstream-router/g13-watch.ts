import {bot, toolsdb} from '../botbase';
import {createLogStream} from './utils';
import type {eventData} from './main';
const {preprocessDraftForExtract} = require('../tasks/commons');
const TextExtractor = require('../TextExtractor')(bot);

let log, db;

export async function init() {
	log = createLogStream('./g13-watch.out');

	log(`[S] Started`);
	await bot.getSiteInfo();

	db = new toolsdb('g13watch_p').init();
	await db.run(`
		CREATE TABLE IF NOT EXISTS g13(
			name VARCHAR(255) UNIQUE,
			description VARCHAR(255),
			excerpt BLOB,
			size INT,
			ts TIMESTAMP NOT NULL
		) COLLATE 'utf8_unicode_ci'
	`); // use utf8_unicode_ci so that MariaDb allows a varchar(255) field to have unique constraint
	// max index column size is 767 bytes. 255*3 = 765 bytes with utf8, 255*4 = 1020 bytes with utf8mb4
}

export function filter(data) {
	return data.wiki === 'enwiki' &&
		data.type === 'categorize' &&
		data.title === 'Category:Candidates for speedy deletion as abandoned drafts or AfC submissions';
}

export async function worker(data: eventData) {
	let match = /^\[\[:(.*?)\]\] added/.exec(data.comment);
	if (!match) {
		return;
	}

	let title = match[1];
	// data.timestamp is *seconds* since epoch
	// This date object will be passed to db
	let ts = data.timestamp ? new bot.date(data.timestamp * 1000) : null;
	log(`[+] Page ${title} at ${ts}`);
	let pagedata = await bot.read(title, {
		prop: 'revisions|description',
		rvprop: 'content|size'
	});
	let text = pagedata?.revisions?.[0]?.content;
	let size = pagedata?.revisions?.[0].size;
	let desc = pagedata?.description;
	if (desc && desc.size > 255) {
		desc = desc.slice(0, 250) + ' ...';
	}
	let extract = TextExtractor.getExtract(text, 300, 550, preprocessDraftForExtract);

	try {
		await db.run(`INSERT INTO g13 VALUES(?, ?, ?, ?, ?)`, [title, desc, extract, size, ts]);
	} catch (err) {
		if (err.code === 'ER_DUP_ENTRY') {
			log(`[W] ${title} entered category more than once`);
			return;
		}
		log(err);
	}
}
