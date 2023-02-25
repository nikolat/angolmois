import {
	Filter,
	SimplePool,
	nip19,
	Sub,
	generatePrivateKey,
	getPublicKey,
	getEventHash,
	signEvent
} from 'nostr-tools';
import 'websocket-polyfill';

// https://gist.github.com/syusui-s/cd5482ddfc83792b54a756759acbda55
// This code is Public domain (Creative Commons Zero CC0-1.0)
// https://creativecommons.org/publicdomain/zero/1.0/deed.ja

// from nostr-tools (Public domains)
export type NostrEvent = {
	id?: string;
	kind: number;
	tags: string[][];
	pubkey: string;
	content: string;
	created_at: number;
};

type NostrAPI = {
	/** returns a public key as hex */
	getPublicKey(): Promise<string>;
	/** takes an event object, adds `id`, `pubkey` and `sig` and returns it */
	signEvent(event: Event): Promise<NostrEvent>;

	// Optional

	/** returns a basic map of relay urls to relay policies */
	getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;

	/** NIP-04: Encrypted Direct Messages */
	nip04: {
		/** returns ciphertext and iv as specified in nip-04 */
		encrypt(pubkey: string, plaintext: string): Promise<string>;
		/** takes ciphertext and iv as specified in nip-04 */
		decrypt(pubkey: string, ciphertext: string): Promise<string>;
	};
};

interface Window {
	nostr?: NostrAPI;
}
declare var window: Window;

(function (){
	const defaultRelays = [
		'wss://relay-jp.nostr.wirednet.jp',
		'wss://nostr.holybea.com',
		'wss://nostr.h3z.jp',
	];
	const additionalRelays = [
		'wss://relay.nostr.wirednet.jp',
		'wss://nostr-relay.nokotaro.com',
		'wss://relay.nostr.or.jp',
		'wss://relay.damus.io',
		'wss://relay.snort.social'
	];
	const bottleRelays = [
		'wss://relay-jp.nostr.wirednet.jp',
		'wss://nostr.holybea.com'
	];
	const bottleKinds: number[] = [9801, 9821];
	const defaultBottleKind = 9801;
	const iconSize = 50;
	const hasDOM: boolean = typeof window === 'object';
	const isElectron: boolean = hasDOM ? (window as any).api != undefined : false;
	const dtformat = new Intl.DateTimeFormat('ja-jp', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	//使い捨ての秘密鍵で投稿するものとする
	const sk = generatePrivateKey();
	const pk = getPublicKey(sk);

	//このsubsは全スコープで使い回す
	let subsBase: Sub;
	//起動中のゴーストを検索
	let ghostNames: string[] = [];
	let keroNames: string[] = [];
	let hwnds: string[] = [];
	if (isElectron) {
		(window as any).api.ReceiveGhostInfo((data: string[][]) => {
			hwnds = data[0];
			ghostNames = data[1];
			keroNames = data[2];
			//ドロップダウンメニューに配置
			const sstpTarget = <HTMLSelectElement>document.getElementById('sstp-target');
			const ifGhost = <HTMLSelectElement>document.getElementById('bottle-ifghost');
			const n = sstpTarget.childElementCount;
			for (let i = 0; i < n; i++) {
				sstpTarget.remove(0);
				ifGhost.remove(0);
			}
			for (let i = 0; i < ghostNames.length; i++) {
				const optionSstpTarget = <HTMLOptionElement>document.createElement('option');
				optionSstpTarget.setAttribute('value', ghostNames[i]);
				optionSstpTarget.appendChild(document.createTextNode(ghostNames[i]));
				sstpTarget.appendChild(optionSstpTarget);
				const optionIgGhost = <HTMLOptionElement>document.createElement('option');
				optionIgGhost.setAttribute('value', ghostNames[i] + ',' + keroNames[i]);
				optionIgGhost.appendChild(document.createTextNode(ghostNames[i] + ',' + keroNames[i]));
				ifGhost.appendChild(optionIgGhost);
			}
			bottleSend.disabled = ghostNames.length == 0;
		});
		(window as any).api.RequestGhostInfo();
		const refreshButton = <HTMLButtonElement>document.getElementById('refresh');
		refreshButton.addEventListener('click', function(){(window as any).api.RequestGhostInfo()});
		//Bottle送信
		const bottleSend = <HTMLButtonElement>document.getElementById('bottle-send');
		bottleSend.addEventListener('click', function(ev: MouseEvent) {
			const bottleScript = <HTMLTextAreaElement>document.getElementById('bottle-script');
			if (bottleScript == null) {
				return;
			}
			const script = bottleScript.value.replace(/\n/g, '');
			if (script == '') {
				return;
			}
			const ifGhost = (<HTMLSelectElement>document.getElementById('bottle-ifghost')).value;
			const contentDict = {
				'Script': script,
				'IfGhost': ifGhost
			};
			const kind: number = Number((<HTMLSelectElement>document.getElementById('bottle-kind')).value);
			const newEvent = {
				kind: kind,
				pubkey: pk,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: JSON.stringify(contentDict),
				id: '',
				sig: ''
			};
			newEvent.id = getEventHash(newEvent);
			newEvent.sig = signEvent(newEvent, sk);
			const pubs = pool.publish(bottleRelays, newEvent);
			pubs.forEach(pub => {
				pub.on('ok', () => {
					console.log('Send Bottle: ', contentDict);
				});
				pub.on('failed', (reason: any) => {
					console.log('Send Bottle Failed: ', reason);
				});
			});
		});
	}
	if (hasDOM) {
		//タブ切り替え
		const radioBtns = <NodeListOf<HTMLInputElement>>document.querySelectorAll('.tabs > input[type="radio"]');
		radioBtns.forEach(radio => {
			radio.addEventListener('change', () => {
				if (radio.checked) {
					const kind: number = Number((<HTMLSelectElement>document.getElementById('bottle-kind')).value);
					if (radio.id == 'global' || radio.id == 'following') {
						subsBase.unsub();
						subsBase = connectRelay(defaultRelays);
					}
					else if (radio.id == 'bottle') {
						subsBase.unsub();
						subsBase = connectBottleRelay(bottleRelays, kind);
					}
				}
			});
		});
		(<HTMLSelectElement>document.getElementById('bottle-kind')).addEventListener('change', () => {
			const kind: number = Number((<HTMLSelectElement>document.getElementById('bottle-kind')).value);
			subsBase.unsub();
			subsBase = connectBottleRelay(bottleRelays, kind);
		});
		(window as any).addEventListener('load', () => {
			//NIP-07認証を使用するチェック
			const useNip07 = <HTMLInputElement>document.getElementById('use-nip-07');
			const npubNip07 = <HTMLInputElement>document.getElementById('npub-nip-07');
			if (window.nostr && window.nostr.getPublicKey) {
				useNip07.addEventListener('change', async() => {
					if (useNip07.checked) {
						await (async function() {
							const npub: any = await window.nostr?.getPublicKey()
							npubNip07.value = nip19.npubEncode(npub);
						})();
					}
					else {
						npubNip07.value = '';
					}
				});
			}
			else {
				useNip07.disabled = true;
				npubNip07.disabled = true;
			}
		});
	}

	//DirectSSTPを送信する関数
	function sendDirectSSTP(note: string, ifGhost: string, name?: string, display_name?: string, picture?: string) {
		const index = (<HTMLSelectElement>document.getElementById('sstp-target')).selectedIndex;
		const hwnd = hwnds[index];
		const script = '\\0' + note.replace(/\\/g, '\\\\').replace(/\n/g, '\\n') + '\\e';
		if (name) {
			(window as any).api.SendSSTP([hwnd, script, ifGhost, note.replace(/\n/g, '\\n'), name, display_name, picture]);
		}
		else {
			(window as any).api.SendSSTP([hwnd, note.replace(/\n/g, '\\n'), ifGhost]);
		}
	}

	//初回接続
	const pool = new SimplePool();
	subsBase = connectRelay(defaultRelays);
	//ts-doneで実行する際はDOM操作はできない
	if (hasDOM) {
		//リレーをセレクトボックスに入れる
		deployRelay(defaultRelays, additionalRelays, bottleRelays, bottleKinds);
		//公開鍵の入力に反応
		const pubkeyInput = <HTMLInputElement>document.getElementById('pubkey');

		let subsFollowing: Sub;
		pubkeyInput.addEventListener('change', () => {
			const {type, data} = nip19.decode(pubkeyInput.value);
			let pubkey: string = '';
			if (typeof data === 'string') {
				pubkey = data;
			}
			else {
				return;
			}
			const f3: Filter = {
				kinds: [3],
				authors: [pubkey],
				limit: 1
			};
			//グローバルのリレーとフォロー中リレーから取得する
			const tRelays: string[] = [];
			Array.from((<HTMLSelectElement>document.getElementById('enabled-relay')).options).forEach(option => {
				tRelays.push(option.value);
			});
			Array.from((<HTMLSelectElement>document.getElementById('following-relay')).options).forEach(option => {
				tRelays.push(option.value);
			});
			const subsF3 = pool.sub(Array.from(new Set(tRelays)), [f3]);
			let gotF3 = false;
			subsF3.on('event', (eventF3: any) => {
				if (gotF3) {
					return;
				}
				gotF3 = true;
				const relays: any = JSON.parse(eventF3.content);
				const relaysa: string[] = [];
				const followings: string[] = [];
				eventF3.tags.forEach((tag: string[]) => {
					if (tag[0] == 'p') {
						followings.push(tag[1]);
					}
				});
				const followingRelays = <HTMLSelectElement>document.getElementById('following-relay');
				Array.from(followingRelays.options).forEach(option => {
					followingRelays.remove(0);
				});
				Object.keys(relays).forEach(function(relay) {
					relaysa.push(relay);
					const op = <HTMLOptGroupElement>document.createElement('option');
					op.textContent = relay;
					followingRelays.add(op);
				});
				relaysa.forEach(async function(relay) {
					try {
						await pool.ensureRelay(relay);
					} catch (error) {
						console.log('ensureRelay error: ', error);
					}
				});
				const f0: Filter = {
					kinds: [0],
					authors: [pubkey],
					limit: 1
				};
				const subsF0 = pool.sub(relaysa, [f0]);
				subsF0.on('event', (eventF0: any) => {
					const c: any = JSON.parse(eventF0.content);
					const dt = <HTMLElement>document.getElementById('profile-dt');
					dt.innerHTML = '';
					if (c.picture != undefined) {
						const img = document.createElement('img');
						img.src = c.picture;
						img.alt = c.name;
						img.width = iconSize;
						img.height = iconSize;
						dt.appendChild(img);
					}
					dt.appendChild(document.createTextNode(c.display_name));
					const a = document.createElement('a');
					a.setAttribute('href', 'https://iris.to/' + nip19.npubEncode(eventF0.pubkey));
					a.textContent = '@' + c.name;
					dt.appendChild(a);
					const dd = <HTMLElement>document.getElementById('profile-dd');
					dd.innerHTML = '';
					dd.appendChild(document.createTextNode(c.about));
				});
				subsF0.on('eose', () => {
					subsF0.unsub();
				});
				followings.push(pubkey);
				const f1: Filter = {
					kinds: [1],
					authors: followings,
					since: Math.floor(Date.now() / 1000) - 30 * 60,
					limit: 20
				};
				const subsF1 = pool.sub(relaysa, [f1]);
				const dl = <HTMLElement>document.getElementById('following-tl');
				dl.innerHTML = '';
				subsF1.on('event', (eventF1: any) => {
					makeTL('following', relaysa, eventF1);
				});
				subsF1.on('eose', () => {
				});
				subsFollowing.unsub();
				subsFollowing = subsF1;
			});
			subsF3.on('eose', () => {
				subsF3.unsub();
			});
		});
	}

	//逆引きできるよう投稿者の情報をためておく
	const pubkeys: { [key: string]: string; } = {};//idからpubkeyを逆引きするためのもの
	const names: { [key: string]: string; } = {};//pubkeyからプロフィール情報を逆引きするためのもの
	function makeTL(tabID: string, relays: string[], event: any) {
		//投稿者のプロフィールを取得
		const f2: Filter = {
			kinds: [0],
			authors: [event.pubkey]
		};
		const subs2 = pool.sub(relays, [f2]);
		let added: boolean = false;
		subs2.on('event', (event2: any) => {
			//保存時期が異なるプロフィールがそれぞれのリレーから送られる場合がある
			if (added) {
				return;
			}
			//プロフィール情報は最初のリレーの1個で十分(リレーによっては古いプロフィール情報が保存されている場合があるため複数やってくる)
			added = true;
			const profile = JSON.parse(event2.content);
			//プロフィールが見つかったnote
//			console.log('note text: ', event.content);
//			console.log('profile: ', profile);
//			console.log('note: ', event);
			//レンダリング
			const dt = document.createElement('dt');
			if (profile.picture != undefined) {
				const img = document.createElement('img');
				img.src = profile.picture;
				img.alt = profile.name;
				img.width = iconSize;
				img.height = iconSize;
				dt.appendChild(img);
			}
			dt.appendChild(document.createTextNode(profile.display_name));
			const a = document.createElement('a');
			a.setAttribute('href', 'https://iris.to/' + nip19.npubEncode(event.pubkey));
			a.textContent = '@' + profile.name;
			dt.appendChild(a);
			const time = document.createElement('time');
			time.textContent = dtformat.format(new Date(event.created_at * 1000));
			dt.appendChild(time);
			dt.setAttribute('id', tabID + '-' + nip19.noteEncode(event.id));
			dt.setAttribute('data-timestamp', event.created_at);
			const dd = document.createElement('dd');
			let hasReply: boolean = false;
			let hasMention: boolean = false;
			let in_reply_to: string = '';
			let mention_to: string = '';
			const mentions: string[] = [];
			event.tags.forEach((tag: any) => {
				if (tag[0] == 'e') {
					hasReply = true;
					in_reply_to = tag[1];
					mentions.push(nip19.noteEncode(tag[1]));
				}
				else if (tag[0] == 'p') {
					hasMention = true;
					mentions.push(nip19.npubEncode(tag[1]));
				}
			});
			if (hasReply && names[pubkeys[in_reply_to]] != undefined) {
				dd.appendChild(document.createTextNode('@' + names[pubkeys[in_reply_to]]));
				dd.appendChild(document.createElement('br'));
			}
			else if (hasMention && names[mention_to] != undefined) {
				dd.appendChild(document.createTextNode('@' + names[mention_to]));
				dd.appendChild(document.createElement('br'));
			}
			event.content.split(/(#\[\d+\])/).forEach((e: string) => {
				const m = e.match(/#\[(\d+)\]/);
				if (m) {
					const aId = document.createElement('a');
					aId.setAttribute('href', '#' + nip19.npubEncode(mentions[Number(m[1])]));
					aId.textContent = e;
					dd.appendChild(aId);
				}
				else {
					dd.appendChild(document.createTextNode(e));
				}
			});
			//SSTP Button
			if (isElectron) {
				const SSTPButton = document.createElement('button');
				SSTPButton.textContent = 'Send SSTP';
				SSTPButton.addEventListener('click', function(ev: MouseEvent) {
					sendDirectSSTP(event.content, '', profile.name ? profile.name : '', profile.display_name ? profile.display_name : '', profile.picture ? profile.picture : '');
				});
				dt.appendChild(SSTPButton);
			}
			//Change ID Button
			const changeIdButton = document.createElement('button');
			changeIdButton.textContent = 'この人でログインする';
			changeIdButton.addEventListener('click', function(ev: MouseEvent) {
				const pubkeyInput = <HTMLInputElement>document.getElementById('pubkey');
				pubkeyInput.value = nip19.npubEncode(event.pubkey);
				pubkeyInput.dispatchEvent(new Event('change'));
				const followingInput = <HTMLInputElement>document.getElementById('following');
				followingInput.checked = true;
			});
			dt.appendChild(changeIdButton);
			//relay
			const ulFrom = <HTMLUListElement>document.createElement('ul');
			ulFrom.className = 'relay';
			pool.seenOn(event.id).forEach(relay => {
				const liFrom = <HTMLLIElement>document.createElement('li');
				liFrom.textContent = relay;
				ulFrom.appendChild(liFrom);
			});
			dd.appendChild(ulFrom);
			const dl = <HTMLElement>document.getElementById(tabID + '-tl');
			//情報をためておく
			if (!(profile.name in names)) {
				names[event.pubkey] = profile.name;
			}
			if (!(event.id in pubkeys)) {
				pubkeys[event.id] = event.pubkey;
			}
			//重複表示回避
			if (document.getElementById(tabID + '-' + nip19.noteEncode(event.id))) {
				return;
			}
			//時系列に表示する
			const dts = dl.querySelectorAll('dt')
			let appended: boolean = false;
			let isNewest: boolean = false;
			if (dts.length > 0) {
				for (let i = 0; i < dts.length; i++) {
					const t: number = Number(dts[i].dataset.timestamp);
					if (t < event.created_at) {
						dl.insertBefore(dd, dts[i]);
						dl.insertBefore(dt, dd);
						appended = true;
						if (i == 0) {
							isNewest = true;
						}
						break;
					}
				}
				if (!appended) {
					dl.appendChild(dt);
					dl.appendChild(dd);
					appended = true;
				}
			} else {
				isNewest = true;
				dl.prepend(dd);
				dl.prepend(dt);
			}
			//ゴーストにDirectSSTPを送信
			if ((<HTMLInputElement>document.getElementById(tabID)).checked && isNewest) {
				sendDirectSSTP(event.content, '', profile.name ? profile.name : '', profile.display_name ? profile.display_name : '', profile.picture ? profile.picture : '');
			}
		});
		subs2.on('eose', () => {
			subs2.unsub();
		});
	}

	function makeBottleTL(tabID: string, event: any) {
		const headers = JSON.parse(event.content);
		const ifGhost = headers.IfGhost;
		const script = headers.Script;
		//レンダリング
		const dt = document.createElement('dt');
		dt.appendChild(document.createTextNode(ifGhost));
		const time = document.createElement('time');
		time.textContent = dtformat.format(new Date(event.created_at * 1000));
		dt.appendChild(time);
		dt.setAttribute('id', tabID + '-' + nip19.noteEncode(event.id));
		dt.setAttribute('data-timestamp', event.created_at);
		const dd = document.createElement('dd');
		//SSTP Button
		if (isElectron) {
			const SSTPButton = document.createElement('button');
			SSTPButton.textContent = 'Send SSTP';
			SSTPButton.addEventListener('click', function(ev: MouseEvent) {
				sendDirectSSTP(script, ifGhost);
			});
			dt.appendChild(SSTPButton);
		}
		//Script
		dd.appendChild(document.createTextNode(script));
		//relay
		const ulFrom = <HTMLUListElement>document.createElement('ul');
		ulFrom.className = 'relay';
		pool.seenOn(event.id).forEach(relay => {
			const liFrom = <HTMLLIElement>document.createElement('li');
			liFrom.textContent = relay;
			ulFrom.appendChild(liFrom);
		});
		dd.appendChild(ulFrom);
		const dl = <HTMLElement>document.getElementById(tabID + '-tl');
		//重複表示回避
		if (document.getElementById(tabID + '-' + nip19.noteEncode(event.id))) {
			return;
		}
		//時系列に表示する
		const dts = dl.querySelectorAll('dt')
		let appended: boolean = false;
		let isNewest: boolean = false;
		if (dts.length > 0) {
			for (let i = 0; i < dts.length; i++) {
				const t: number = Number(dts[i].dataset.timestamp);
				if (t < event.created_at) {
					dl.insertBefore(dd, dts[i]);
					dl.insertBefore(dt, dd);
					appended = true;
					if (i == 0) {
						isNewest = true;
					}
					break;
				}
			}
			if (!appended) {
				dl.appendChild(dt);
				dl.appendChild(dd);
				appended = true;
			}
		} else {
			isNewest = true;
			dl.prepend(dd);
			dl.prepend(dt);
		}
		//ゴーストにDirectSSTPを送信
		if ((<HTMLInputElement>document.getElementById(tabID)).checked && isNewest) {
			sendDirectSSTP(script, ifGhost);
		}
	}

	//リレーに繋ぐ
	function connectRelay(relays: string[]) {
		//30分以内の投稿を取得
		const f: Filter = {
			kinds: [1],
			since: Math.floor(Date.now() / 1000) - 30 * 60,
			limit: 20
		};
		const subsCon = pool.sub(relays, [f]);
		if (hasDOM) {
			const dl = <HTMLElement>document.getElementById('global-tl');
			dl.innerHTML = '';
		}
		subsCon.on('event', (event: any) => {
			makeTL('global', relays, event);
		});
		//このsubsは全スコープで使い回す必要があるためreturnしてあげる
		return subsCon;
	}
	//ボトル用リレーに繋ぐ
	function connectBottleRelay(relays: string[], kind: number) {
		//1週間以内の投稿を取得
		const f: Filter = {
			kinds: [kind],
			since: Math.floor(Date.now() / 1000) - 7 * 24 *60 * 60,
			limit: 20
		};
		const subsCon = pool.sub(relays, [f]);
		if (hasDOM) {
			const dl = <HTMLElement>document.getElementById('bottle-tl');
			dl.innerHTML = '';
		}
		subsCon.on('event', (event: any) => {
			makeBottleTL('bottle', event);
		});
		subsCon.on('eose', () => {
		});
		//このsubsは全スコープで使い回す必要があるためreturnしてあげる
		return subsCon;
	}

	//リレーをセレクトボックスに入れる(初回だけ呼ばれて終わり)
	function deployRelay(enabledRelay: string[], disabledRelay: string[], bottleRelay: string[], bottleKinds: number[]) {
		//デフォルトリレー配置
		const enabledSelect = document.getElementById('enabled-relay');
		enabledRelay.forEach(relay => {
			const option = document.createElement('option');
			option.setAttribute('value', relay);
			option.appendChild(document.createTextNode(relay));
			enabledSelect?.appendChild(option);
		});
		//オプションリレー配置
		const disabledSelect = document.getElementById('disabled-relay');
		disabledRelay.forEach(relay => {
			const option = document.createElement('option');
			option.setAttribute('value', relay);
			option.appendChild(document.createTextNode(relay));
			disabledSelect?.appendChild(option);
		});
		//ボトルリレー配置
		const bottleSelect = document.getElementById('bottle-relay');
		bottleRelay.forEach(relay => {
			const option = document.createElement('option');
			option.setAttribute('value', relay);
			option.appendChild(document.createTextNode(relay));
			bottleSelect?.appendChild(option);
		});
		//ボトルKind配置
		const kindSelect = document.getElementById('bottle-kind');
		bottleKinds.forEach(kind => {
			const option = document.createElement('option');
			option.setAttribute('value', kind.toString());
			option.appendChild(document.createTextNode(kind.toString()));
			if (kind == defaultBottleKind) {
				option.selected = true;
			}
			kindSelect?.appendChild(option);
		});
		//追加⇔削除ボタン押下時に入れ替え
		document.getElementById('remove')?.addEventListener('click', () => replaceRelay('enabled-relay', 'disabled-relay'));
		document.getElementById('add')?.addEventListener('click', () => replaceRelay('disabled-relay', 'enabled-relay'));
		//追加⇔削除
		function replaceRelay(from: string, to: string) {
			const enabledNode = <HTMLSelectElement>document.getElementById(from);
			if (!(enabledNode.selectedIndex >= 0)) {
				return;
			}
			const relayName: string = enabledNode.options[enabledNode.selectedIndex].value;
			const disabledNode = <HTMLSelectElement>document.getElementById(to);
			const option = <HTMLOptionElement>document.createElement('option');
			option.setAttribute('value', relayName);
			option.appendChild(document.createTextNode(relayName));
			disabledNode.appendChild(option);
			enabledNode.remove(enabledNode.selectedIndex);
			const newRelays: string[] = [];
			Array.from((<HTMLSelectElement>document.getElementById('enabled-relay')).options).forEach(option => {
				newRelays.push(option.value);
			});
			//改めてリレーに繋ぎ直す
			subsBase.unsub();
			subsBase = connectRelay(newRelays);
		}
	}
})();
