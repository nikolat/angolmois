import { Filter, SimplePool, nip19 } from 'nostr-tools';
import 'websocket-polyfill';

(function (){
	const defaultRelays = [
		'wss://relay-jp.nostr.wirednet.jp',
		'wss://nostr-relay.nokotaro.com',
		'wss://relay.nostr.wirednet.jp',
		'wss://nostr.h3z.jp',
		'wss://nostr.h3y6e.com',
		'wss://nostr.holybea.com',
		'wss://relay.nostr.or.jp'
	];
	const additionalRelays = [
		'wss://relay.damus.io',
		'wss://relay.snort.social'
	];
	const iconSize = 50;
	const isElectron: boolean = typeof window === 'object' ? (window as any).api != undefined : false;
	const dtformat = new Intl.DateTimeFormat('ja-jp', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	//起動中のゴーストを検索
	let names: string[] = [];
	let hwnds: string[] = [];
	if (isElectron) {
		(window as any).api.ReceiveGhostInfo((data: string[][]) => {
			names = data[0];
			hwnds = data[1];
			//ドロップダウンメニューに配置
			const sstpTarget = <HTMLSelectElement>document.getElementById('sstp-target');
			const n = sstpTarget.childElementCount;
			for (let i = 0; i < n; i++) {
				sstpTarget.remove(0);
			}
			for (let i = 0; i < names.length; i++) {
				const option = <HTMLOptionElement>document.createElement('option');
				option.setAttribute('value', names[i]);
				option.appendChild(document.createTextNode(names[i]));
				sstpTarget?.appendChild(option);
			}
		});
		(window as any).api.RequestGhostInfo();
		const refreshButton = <HTMLButtonElement>document.getElementById('refresh');
		refreshButton.addEventListener('click', function(){(window as any).api.RequestGhostInfo()});
	}
	//DirectSSTPを送信する関数
	function sendDirectSSTP(note: string, name: string, display_name: string, picture: string) {
		const index = (<HTMLSelectElement>document.getElementById('sstp-target')).selectedIndex;
		const hwnd = hwnds[index];
		const script = '\\0' + note.replace(/\\/g, '\\\\').replace(/\n/g, '\\n') + '\\e';
		(window as any).api.SendSSTP([hwnd, script, note.replace(/\n/g, '\\n'), name, display_name, picture]);
	}

	const pool = new SimplePool();
	//初回の接続
	let subs = connectRelay(defaultRelays);//このsubsは全スコープで使い回す
	//ts-doneで実行する際はDOM操作はできない
	const hasDOM: boolean = typeof window === 'object';
	if (hasDOM) {
		//リレーをセレクトボックスに入れる
		deployRelay(defaultRelays, additionalRelays);
	}

	//リレーに繋ぐ
	function connectRelay(relays: string[]) {
		//現在時刻以降の投稿を取得
		const f: Filter = {
			kinds: [1],
			since: Math.floor(Date.now() / 1000),
			limit: 1
		};
		const subs = pool.sub(relays, [f]);
		//逆引きできるよう投稿者の情報をためておく
		const pubkeys: { [key: string]: string; } = {};//idからpubkeyを逆引きするためのもの
		const names: { [key: string]: string; } = {};//pubkeyからプロフィール情報を逆引きするためのもの
		subs.on('event', (event: any) => {
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
				console.log('note text: ', event.content);
				console.log('profile: ', profile);
				console.log('note: ', event);
				//console.log('relay: ', pool.seenOn(event.id));
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
				a.textContent = "@" + profile.name;
				dt.appendChild(a);
				const time = document.createElement('time');
				time.textContent = dtformat.format(new Date(event.created_at * 1000));
				dt.appendChild(time);
				dt.setAttribute('id', nip19.noteEncode(event.id));
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
						sendDirectSSTP(event.content, profile.name ? profile.name : '', profile.display_name ? profile.display_name : '', profile.picture ? profile.picture : '');
					});
					dt.appendChild(SSTPButton);
				}
				//relay
				const ulFrom = <HTMLUListElement>document.createElement('ul');
				ulFrom.className = 'relay';
				pool.seenOn(event.id).forEach(relay => {
					const liFrom = <HTMLLIElement>document.createElement('li');
					liFrom.textContent = relay;
					ulFrom.appendChild(liFrom);
				});
				dd.appendChild(ulFrom);
				const dl = document.getElementById('main');
				//情報をためておく
				if (!(profile.name in names)) {
					names[event.pubkey] = profile.name;
				}
				if (!(event.id in pubkeys)) {
					pubkeys[event.id] = event.pubkey;
					dl?.prepend(dd);
					dl?.prepend(dt);
					//ゴーストにDirectSSTPを送信
					sendDirectSSTP(event.content, profile.name ? profile.name : '', profile.display_name ? profile.display_name : '', profile.picture ? profile.picture : '');
				}
			});
			subs2.on('eose', () => {
				//console.log('eose: getting profile of ' + event.pubkey);
				subs2.unsub();
			});
		});
		//このsubsは全スコープで使い回す必要があるためreturnしてあげる
		return subs;
	}

	//リレーをセレクトボックスに入れる(初回だけ呼ばれて終わり)
	function deployRelay(enabledRelay: string[], disabledRelay: string[]) {
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
			subs.unsub();
			subs = connectRelay(newRelays);
		}
	}
})();
