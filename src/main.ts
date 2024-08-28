import type { SubCloser } from 'nostr-tools/abstract-pool';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import type { WindowNostr } from 'nostr-tools/nip07';
import * as nip19 from 'nostr-tools/nip19';
import {
  type NostrEvent,
  generateSecretKey,
  UnsignedEvent,
  finalizeEvent,
} from 'nostr-tools/pure';
import './style.css';

declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}

(function () {
  const defaultRelays = [
    'wss://relay-jp.nostr.wirednet.jp',
    'wss://yabu.me',
    'wss://r.kojira.io',
    'wss://nrelay-jp.c-stellar.net',
  ];
  const additionalRelays = [
    'wss://relay.nostr.wirednet.jp',
    'wss://relay.damus.io',
    'wss://nos.lol',
  ];
  const bottleRelays = [
    'wss://relay-jp.nostr.wirednet.jp',
    'wss://yabu.me',
    'wss://r.kojira.io',
    'wss://nrelay-jp.c-stellar.net',
  ];
  const bottleKinds: number[] = [9801, 9821];
  const defaultBottleKind = 9801;
  const iconSize = 50;
  const baseLinkURL = 'https://nostx.shino3.net/';
  const sspServerURL = 'http://localhost:9801';
  const dtformat = new Intl.DateTimeFormat('ja-jp', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  //使い捨ての秘密鍵で投稿するものとする
  const sk = generateSecretKey();

  //このsubsは全スコープで使い回す
  let subsBase: SubCloser;
  //起動中のゴーストを検索
  let ghostNames: string[] = [];
  let keroNames: string[] = [];
  let hwnds: string[] = [];

  function ReceiveGhostInfo(data: string[][]) {
    hwnds = data[0];
    ghostNames = data[1];
    keroNames = data[2];
    //ドロップダウンメニューに配置
    const sstpTarget = <HTMLSelectElement>(
      document.getElementById('sstp-target')
    );
    const ifGhost = <HTMLSelectElement>(
      document.getElementById('bottle-ifghost')
    );
    const n = sstpTarget.childElementCount;
    for (let i = 0; i < n; i++) {
      sstpTarget.remove(0);
      ifGhost.remove(0);
    }
    for (let i = 0; i < ghostNames.length; i++) {
      const optionSstpTarget = <HTMLOptionElement>(
        document.createElement('option')
      );
      optionSstpTarget.setAttribute('value', ghostNames[i]);
      optionSstpTarget.appendChild(document.createTextNode(ghostNames[i]));
      sstpTarget.appendChild(optionSstpTarget);
      const optionIgGhost = <HTMLOptionElement>document.createElement('option');
      optionIgGhost.setAttribute('value', ghostNames[i] + ',' + keroNames[i]);
      optionIgGhost.appendChild(
        document.createTextNode(ghostNames[i] + ',' + keroNames[i]),
      );
      ifGhost.appendChild(optionIgGhost);
    }
    const bottleSend = <HTMLButtonElement>(
      document.getElementById('bottle-send')
    );
    bottleSend.disabled = ghostNames.length == 0;
  }
  RequestGhostInfo();
  const refreshButton = <HTMLButtonElement>document.getElementById('refresh');
  refreshButton.addEventListener('click', function () {
    RequestGhostInfo();
  });
  //Bottle送信
  const bottleSend = <HTMLButtonElement>document.getElementById('bottle-send');
  bottleSend.addEventListener('click', async function (ev: MouseEvent) {
    const bottleScript = <HTMLTextAreaElement>(
      document.getElementById('bottle-script')
    );
    if (bottleScript == null) {
      return;
    }
    const script = bottleScript.value.replace(/\n/g, '');
    if (script == '') {
      return;
    }
    bottleSend.disabled = true;
    const ifGhost = (<HTMLSelectElement>(
      document.getElementById('bottle-ifghost')
    )).value;
    const contentDict = {
      Script: script,
      IfGhost: ifGhost,
    };
    const kind = Number(
      (<HTMLSelectElement>document.getElementById('bottle-kind')).value,
    );
    const baseEvent: UnsignedEvent = {
      kind: kind,
      pubkey: '',
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(contentDict),
    };
    let newEvent: NostrEvent;
    const useNip07 = <HTMLInputElement>document.getElementById('use-nip-07');
    if (useNip07.checked && window.nostr) {
      newEvent = await window.nostr.signEvent(baseEvent);
    } else {
      newEvent = finalizeEvent(baseEvent, sk);
    }
    pool.publish(bottleRelays, newEvent);
    bottleScript.value = '';
    bottleSend.disabled = false;
  });
  //タブ切り替え
  const radioBtns = <NodeListOf<HTMLInputElement>>(
    document.querySelectorAll('.tabs > input[type="radio"]')
  );
  radioBtns.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        const kind: number = Number(
          (<HTMLSelectElement>document.getElementById('bottle-kind')).value,
        );
        if (radio.id == 'global' || radio.id == 'following') {
          subsBase.close();
          subsBase = connectRelay(defaultRelays);
        } else if (radio.id == 'bottle') {
          subsBase.close();
          subsBase = connectBottleRelay(bottleRelays, kind);
        }
      }
    });
  });
  (<HTMLSelectElement>document.getElementById('bottle-kind')).addEventListener(
    'change',
    () => {
      const kind: number = Number(
        (<HTMLSelectElement>document.getElementById('bottle-kind')).value,
      );
      subsBase.close();
      subsBase = connectBottleRelay(bottleRelays, kind);
    },
  );
  (window as EventTarget).addEventListener('load', () => {
    //NIP-07を使用するチェック
    const useNip07 = <HTMLInputElement>document.getElementById('use-nip-07');
    const npubNip07 = <HTMLInputElement>document.getElementById('npub-nip-07');
    //NIP-07でログインするチェック
    const loginWithNip07 = <HTMLInputElement>(
      document.getElementById('login-with-nip-07')
    );
    if (window.nostr && window.nostr.getPublicKey) {
      loginWithNip07.addEventListener('change', async (e) => {
        const pubkeyInput = <HTMLInputElement>document.getElementById('pubkey');
        if (loginWithNip07.checked) {
          const npub = await window.nostr?.getPublicKey();
          if (npub !== undefined) {
            pubkeyInput.value = nip19.npubEncode(npub);
            pubkeyInput.dispatchEvent(new Event('change'));
          }
        } else {
          pubkeyInput.value = '';
          pubkeyInput.dispatchEvent(new Event('change'));
        }
      });
      useNip07.addEventListener('change', async () => {
        if (useNip07.checked) {
          await (async function () {
            const npub = await window.nostr?.getPublicKey();
            if (npub !== undefined) {
              //公開鍵表示
              npubNip07.value = nip19.npubEncode(npub);
              //プロフィール表示
              const f0: Filter = {
                kinds: [0],
                authors: [npub],
                limit: 1,
              };
              //グローバルのリレーとフォロー中リレーとボトル用リレーから取得する
              const tRelays: string[] = [];
              Array.from(
                (<HTMLSelectElement>document.getElementById('enabled-relay'))
                  .options,
              ).forEach((option) => {
                tRelays.push(option.value);
              });
              Array.from(
                (<HTMLSelectElement>document.getElementById('following-relay'))
                  .options,
              ).forEach((option) => {
                tRelays.push(option.value);
              });
              Array.from(
                (<HTMLSelectElement>document.getElementById('bottle-relay'))
                  .options,
              ).forEach((option) => {
                tRelays.push(option.value);
              });
              const onevent = (eventF0: NostrEvent) => {
                const c: any = JSON.parse(eventF0.content);
                const dt = <HTMLElement>(
                  document.getElementById('bottle-profile-dt')
                );
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
                a.setAttribute(
                  'href',
                  baseLinkURL + nip19.npubEncode(eventF0.pubkey),
                );
                a.textContent = '@' + c.name;
                dt.appendChild(a);
                const dd = <HTMLElement>(
                  document.getElementById('bottle-profile-dd')
                );
                dd.innerHTML = '';
                dd.appendChild(document.createTextNode(c.about));
                //TLにアイコン表示
                if (c.picture != undefined) {
                  const dts = <NodeListOf<HTMLElement>>(
                    document.querySelectorAll('#bottle-tl > dt')
                  );
                  dts.forEach((element) => {
                    //自分の投稿だった場合
                    if (element.dataset.npub == nip19.npubEncode(npub)) {
                      const img = document.createElement('img');
                      img.src = c.picture;
                      img.alt = c.name;
                      img.width = iconSize;
                      img.height = iconSize;
                      element.appendChild(img);
                    }
                  });
                }
              };
              const oneose = () => {
                subsF0.close();
              };
              const subsF0 = pool.subscribeMany(tRelays, [f0], {
                onevent,
                oneose,
              });
            }
          })();
        } else {
          npubNip07.value = '';
          const dt = <HTMLElement>document.getElementById('bottle-profile-dt');
          dt.innerHTML = '';
          const dd = <HTMLElement>document.getElementById('bottle-profile-dd');
          dd.innerHTML = '';
          const dts = <NodeListOf<HTMLElement>>(
            document.querySelectorAll('#bottle-tl > dt > img')
          );
          dts.forEach((element) => {
            element.remove();
          });
        }
      });
    } else {
      loginWithNip07.disabled = true;
      useNip07.disabled = true;
      npubNip07.disabled = true;
    }
  });
  //FMOから起動中のゴースト情報を取得
  async function RequestGhostInfo() {
    const mes = [
      'EXECUTE SSTP/1.1',
      'Charset: UTF-8',
      'SecurityLevel: external',
      'Command: GetFMO',
      '',
      '',
    ];
    const res: string = await postData(
      sspServerURL + '/api/sstp/v1',
      mes.join('\n'),
    );
    const lines = res.split('\r\n');
    const hwnds = [];
    const names = [];
    const keronames = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('.hwnd' + String.fromCharCode(1)) >= 0) {
        const hwnd = lines[i]
          .split(String.fromCharCode(1))[1]
          .replace('\r', '');
        hwnds.push(hwnd);
      } else if (lines[i].indexOf('.name' + String.fromCharCode(1)) >= 0) {
        const name = lines[i]
          .split(String.fromCharCode(1))[1]
          .replace('\r', '');
        names.push(name);
      } else if (lines[i].indexOf('.keroname' + String.fromCharCode(1)) >= 0) {
        const keroname = lines[i]
          .split(String.fromCharCode(1))[1]
          .replace('\r', '');
        keronames.push(keroname);
      }
    }
    ReceiveGhostInfo([hwnds, names, keronames]);
  }

  //DirectSSTPを送信する関数
  async function sendSSTP(
    content: string,
    ifGhost: string,
    name?: string,
    display_name?: string,
    picture?: string,
    note?: string,
    npub?: string,
  ) {
    if (!(<HTMLInputElement>document.getElementById('sstp-enable')).checked) {
      return;
    }
    const index = (<HTMLSelectElement>document.getElementById('sstp-target'))
      .selectedIndex;
    const hwnd = hwnds[index];
    const script =
      '\\0' + content.replace(/\\/g, '\\\\').replace(/\n/g, '\\n') + '\\e';
    if (!ifGhost) {
      const res: string = await SSTPSend([
        hwnd,
        script,
        ifGhost,
        1,
        content.replace(/\n/g, '\\n'),
        name,
        display_name,
        picture,
        note,
        npub,
      ]);
    } else {
      const res: string = await SSTPSend([
        hwnd,
        content.replace(/\n/g, '\\n'),
        ifGhost,
      ]);
    }
  }

  async function SSTPSend(data: any) {
    const hwnd = data[0];
    const script = data[1];
    const ifGhost = data[2];
    const mes = [
      'NOTIFY SSTP/1.1',
      'Charset: UTF-8',
      'SecurityLevel: external',
      'Sender: angolmois',
      'Event: OnNostr',
      'Option: nobreak',
      `ReceiverGhostHWnd: ${hwnd}`,
    ];
    if (ifGhost) {
      mes.push(`IfGhost: ${ifGhost}`);
    }
    mes.push(`Script: ${script}`);
    mes.push(`Reference0: ${ifGhost ? 'Nostr-Bottle/0.1' : 'Nostr/0.4'}`);
    for (let i = 3; i < data.length; i++) {
      mes.push(`Reference${i - 2}: ${data[i]}`);
    }
    mes.push('');
    mes.push('');
    const res: string = await postData(
      sspServerURL + '/api/sstp/v1',
      mes.join('\n'),
    );
    console.log(mes.join('\n'), '\n----------\n', res, '\n----------\n');
    return res;
  }

  async function postData(url = '', data = '') {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: data,
    });
    return response.text();
  }

  //初回接続
  const pool = new SimplePool();
  pool.trackRelays = true;
  subsBase = connectRelay(defaultRelays);
  //ts-doneで実行する際はDOM操作はできない
  //リレーをセレクトボックスに入れる
  deployRelay(defaultRelays, additionalRelays, bottleRelays, bottleKinds);
  //公開鍵の入力に反応
  const pubkeyInput = <HTMLInputElement>document.getElementById('pubkey');

  let subsFollowing: SubCloser;
  pubkeyInput.addEventListener('change', () => {
    const { type, data } = nip19.decode(pubkeyInput.value);
    let pubkey: string = '';
    if (typeof data === 'string') {
      pubkey = data;
    } else {
      return;
    }
    const f3: Filter = {
      kinds: [3],
      authors: [pubkey],
      limit: 1,
    };
    //グローバルのリレーとフォロー中リレーから取得する
    const tRelays: string[] = [];
    Array.from(
      (<HTMLSelectElement>document.getElementById('enabled-relay')).options,
    ).forEach((option) => {
      tRelays.push(option.value);
    });
    Array.from(
      (<HTMLSelectElement>document.getElementById('following-relay')).options,
    ).forEach((option) => {
      tRelays.push(option.value);
    });
    let gotF3 = false;
    const onevent = async (eventF3: NostrEvent) => {
      if (gotF3) {
        return;
      }
      let relays: any;
      const relaysa: string[] = [];
      try {
        relays = JSON.parse(eventF3.content);
      } catch (error) {
        console.log(error);
        console.log(eventF3);
        //TODO:NIP-65
        return;
      }
      gotF3 = true;
      const followings: string[] = [];
      eventF3.tags.forEach((tag: string[]) => {
        if (tag[0] == 'p') {
          followings.push(tag[1]);
        }
      });
      const followingRelays = <HTMLSelectElement>(
        document.getElementById('following-relay')
      );
      Array.from(followingRelays.options).forEach((option) => {
        followingRelays.remove(0);
      });
      Object.keys(relays).forEach((relay) => {
        relaysa.push(relay);
        const op = <HTMLOptGroupElement>document.createElement('option');
        op.textContent = relay;
        followingRelays.add(op);
      });
      const procs = relaysa.map((relay) => {
        try {
          pool.ensureRelay(relay);
        } catch (error) {
          console.log('ensureRelay error: ', error);
        }
      });
      const ret = await Promise.all(procs);
      const f0: Filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      };
      const onevent21 = (eventF0: NostrEvent) => {
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
        a.setAttribute('href', baseLinkURL + nip19.npubEncode(eventF0.pubkey));
        a.textContent = '@' + c.name;
        dt.appendChild(a);
        const dd = <HTMLElement>document.getElementById('profile-dd');
        dd.innerHTML = '';
        dd.appendChild(document.createTextNode(c.about));
      };
      const oneose21 = () => {
        subsF0.close();
      };
      const subsF0 = pool.subscribeMany(relaysa, [f0], {
        onevent: onevent21,
        oneose: oneose21,
      });
      followings.push(pubkey);
      const f1: Filter = {
        kinds: [1],
        authors: followings,
        since: Math.floor(Date.now() / 1000) - 30 * 60,
        limit: 20,
      };
      const dl = <HTMLElement>document.getElementById('following-tl');
      dl.innerHTML = '';
      const onevent22 = (eventF1: NostrEvent) => {
        makeTL('following', relaysa, eventF1);
      };
      const oneose22 = () => {};
      const subsF1 = pool.subscribeMany(relaysa, [f1], {
        onevent: onevent22,
        oneose: oneose22,
      });
      if (subsFollowing) {
        subsFollowing.close();
      }
      subsFollowing = subsF1;
    };
    const oneose = () => {
      subsF3.close();
    };
    const subsF3 = pool.subscribeMany(Array.from(new Set(tRelays)), [f3], {
      onevent,
      oneose,
    });
  });

  //逆引きできるよう投稿者の情報をためておく
  const pubkeys: { [key: string]: string } = {}; //idからpubkeyを逆引きするためのもの
  const names: { [key: string]: string } = {}; //pubkeyからプロフィール情報を逆引きするためのもの
  function makeTL(tabID: string, relays: string[], event: NostrEvent) {
    //投稿者のプロフィールを取得
    const f2: Filter = {
      kinds: [0],
      authors: [event.pubkey],
    };
    let added: boolean = false;
    const onevent = (event2: NostrEvent) => {
      if (!event.id) {
        return;
      }
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
      a.setAttribute('href', baseLinkURL + nip19.npubEncode(event.pubkey));
      a.textContent = '@' + profile.name;
      dt.appendChild(a);
      const time = document.createElement('time');
      time.textContent = dtformat.format(new Date(event.created_at * 1000));
      dt.appendChild(time);
      dt.setAttribute('id', tabID + '-' + nip19.noteEncode(event.id));
      dt.setAttribute('data-timestamp', event.created_at.toString());
      const dd = document.createElement('dd');
      let hasReply: boolean = false;
      let hasMention: boolean = false;
      let in_reply_to: string = '';
      let mention_to: string = '';
      const mentions: string[] = [];
      event.tags.forEach((tag) => {
        if (tag[0] == 'e') {
          hasReply = true;
          in_reply_to = tag[1];
          mentions.push(nip19.noteEncode(tag[1]));
        } else if (tag[0] == 'p') {
          hasMention = true;
          mentions.push(nip19.npubEncode(tag[1]));
        }
      });
      if (hasReply && names[pubkeys[in_reply_to]] != undefined) {
        dd.appendChild(
          document.createTextNode('@' + names[pubkeys[in_reply_to]]),
        );
        dd.appendChild(document.createElement('br'));
      } else if (hasMention && names[mention_to] != undefined) {
        dd.appendChild(document.createTextNode('@' + names[mention_to]));
        dd.appendChild(document.createElement('br'));
      }
      event.content.split(/(#\[\d+\])/).forEach((e: string) => {
        const m = e.match(/#\[(\d+)\]/);
        if (m) {
          const aId = document.createElement('a');
          aId.setAttribute(
            'href',
            '#' + nip19.npubEncode(mentions[Number(m[1])]),
          );
          aId.textContent = e;
          dd.appendChild(aId);
        } else {
          dd.appendChild(document.createTextNode(e));
        }
      });
      //SSTP Button
      const SSTPButton = document.createElement('button');
      SSTPButton.textContent = 'Send SSTP';
      SSTPButton.addEventListener('click', function (ev: MouseEvent) {
        sendSSTP(
          event.content,
          '',
          profile.name ?? '',
          profile.display_name ?? '',
          profile.picture ?? '',
          nip19.noteEncode(event.id),
          nip19.npubEncode(event.pubkey),
        );
      });
      dt.appendChild(SSTPButton);
      //Change ID Button
      const changeIdButton = document.createElement('button');
      changeIdButton.textContent = 'この人でログインする';
      changeIdButton.addEventListener('click', function (ev: MouseEvent) {
        const loginWithNip07 = <HTMLInputElement>(
          document.getElementById('login-with-nip-07')
        );
        loginWithNip07.checked = false;
        const pubkeyInput = <HTMLInputElement>document.getElementById('pubkey');
        pubkeyInput.value = nip19.npubEncode(event.pubkey);
        pubkeyInput.dispatchEvent(new Event('change'));
        const followingInput = <HTMLInputElement>(
          document.getElementById('following')
        );
        followingInput.checked = true;
      });
      dt.appendChild(changeIdButton);
      //relay
      const ulFrom = <HTMLUListElement>document.createElement('ul');
      ulFrom.className = 'relay';
      for (const relay of pool.seenOn.get(event.id) ?? []) {
        const liFrom = <HTMLLIElement>document.createElement('li');
        liFrom.textContent = relay.url;
        ulFrom.appendChild(liFrom);
      }
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
      const dts = dl.querySelectorAll('dt');
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
      if (
        (<HTMLInputElement>document.getElementById(tabID)).checked &&
        isNewest
      ) {
        sendSSTP(
          event.content,
          '',
          profile.name ?? '',
          profile.display_name ?? '',
          profile.picture ?? '',
          nip19.noteEncode(event.id),
          nip19.npubEncode(event.pubkey),
        );
      }
    };
    const oneose = () => {
      subs2.close();
    };
    const subs2 = pool.subscribeMany(relays, [f2], { onevent, oneose });
  }

  function makeBottleTL(tabID: string, event: NostrEvent) {
    if (!event.id) {
      return;
    }
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
    dt.setAttribute('data-timestamp', event.created_at.toString());
    dt.setAttribute('data-npub', nip19.npubEncode(event.pubkey));
    //自身の投稿の場合
    if (
      nip19.npubEncode(event.pubkey) ==
      (<HTMLInputElement>document.getElementById('npub-nip-07')).value
    ) {
      //認証済みならアイコンをコピー
      const imgs = <NodeListOf<HTMLImageElement>>(
        document.querySelectorAll('#bottle-profile-dt > img')
      );
      imgs.forEach((element) => {
        dt.appendChild(element.cloneNode(false));
      });
    }
    const dd = document.createElement('dd');
    //SSTP Button
    const SSTPButton = document.createElement('button');
    SSTPButton.textContent = 'Send SSTP';
    SSTPButton.addEventListener('click', function (ev: MouseEvent) {
      sendSSTP(script, ifGhost);
    });
    dt.appendChild(SSTPButton);
    //Script
    dd.appendChild(document.createTextNode(script));
    //relay
    const ulFrom = <HTMLUListElement>document.createElement('ul');
    ulFrom.className = 'relay';
    for (const relay of pool.seenOn.get(event.id) ?? []) {
      const liFrom = <HTMLLIElement>document.createElement('li');
      liFrom.textContent = relay.url;
      ulFrom.appendChild(liFrom);
    }
    dd.appendChild(ulFrom);
    const dl = <HTMLElement>document.getElementById(tabID + '-tl');
    //重複表示回避
    if (document.getElementById(tabID + '-' + nip19.noteEncode(event.id))) {
      return;
    }
    //時系列に表示する
    const dts = dl.querySelectorAll('dt');
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
    if (
      (<HTMLInputElement>document.getElementById(tabID)).checked &&
      isNewest
    ) {
      sendSSTP(script, ifGhost);
    }
  }

  //リレーに繋ぐ
  function connectRelay(relays: string[]) {
    //30分以内の投稿を取得
    const f: Filter = {
      kinds: [1],
      since: Math.floor(Date.now() / 1000) - 30 * 60,
      limit: 20,
    };
    const dl = <HTMLElement>document.getElementById('global-tl');
    dl.innerHTML = '';
    const onevent = (event: NostrEvent) => {
      makeTL('global', relays, event);
    };
    const oneose = () => {};
    const subsCon = pool.subscribeMany(relays, [f], { onevent, oneose });
    //このsubsは全スコープで使い回す必要があるためreturnしてあげる
    return subsCon;
  }
  //ボトル用リレーに繋ぐ
  function connectBottleRelay(relays: string[], kind: number) {
    const f: Filter = {
      kinds: [kind],
      //			since: Math.floor(Date.now() / 1000) - 30 * 24 *60 * 60,
      limit: 20,
    };
    const dl = <HTMLElement>document.getElementById('bottle-tl');
    dl.innerHTML = '';
    const onevent = (event: NostrEvent) => {
      makeBottleTL('bottle', event);
    };
    const oneose = () => {};
    const subsCon = pool.subscribeMany(relays, [f], { onevent, oneose });
    //このsubsは全スコープで使い回す必要があるためreturnしてあげる
    return subsCon;
  }

  //リレーをセレクトボックスに入れる(初回だけ呼ばれて終わり)
  function deployRelay(
    enabledRelay: string[],
    disabledRelay: string[],
    bottleRelay: string[],
    bottleKinds: number[],
  ) {
    //デフォルトリレー配置
    const enabledSelect = document.getElementById('enabled-relay');
    enabledRelay.forEach((relay) => {
      const option = document.createElement('option');
      option.setAttribute('value', relay);
      option.appendChild(document.createTextNode(relay));
      enabledSelect?.appendChild(option);
    });
    //オプションリレー配置
    const disabledSelect = document.getElementById('disabled-relay');
    disabledRelay.forEach((relay) => {
      const option = document.createElement('option');
      option.setAttribute('value', relay);
      option.appendChild(document.createTextNode(relay));
      disabledSelect?.appendChild(option);
    });
    //ボトルリレー配置
    const bottleSelect = document.getElementById('bottle-relay');
    bottleRelay.forEach((relay) => {
      const option = document.createElement('option');
      option.setAttribute('value', relay);
      option.appendChild(document.createTextNode(relay));
      bottleSelect?.appendChild(option);
    });
    //ボトルKind配置
    const kindSelect = document.getElementById('bottle-kind');
    bottleKinds.forEach((kind) => {
      const option = document.createElement('option');
      option.setAttribute('value', kind.toString());
      option.appendChild(document.createTextNode(kind.toString()));
      if (kind == defaultBottleKind) {
        option.selected = true;
      }
      kindSelect?.appendChild(option);
    });
    //追加⇔削除ボタン押下時に入れ替え
    document
      .getElementById('remove')
      ?.addEventListener('click', () =>
        replaceRelay('enabled-relay', 'disabled-relay'),
      );
    document
      .getElementById('add')
      ?.addEventListener('click', () =>
        replaceRelay('disabled-relay', 'enabled-relay'),
      );
    //追加⇔削除
    function replaceRelay(from: string, to: string) {
      const enabledNode = <HTMLSelectElement>document.getElementById(from);
      if (!(enabledNode.selectedIndex >= 0)) {
        return;
      }
      const relayName: string =
        enabledNode.options[enabledNode.selectedIndex].value;
      const disabledNode = <HTMLSelectElement>document.getElementById(to);
      const option = <HTMLOptionElement>document.createElement('option');
      option.setAttribute('value', relayName);
      option.appendChild(document.createTextNode(relayName));
      disabledNode.appendChild(option);
      enabledNode.remove(enabledNode.selectedIndex);
      const newRelays: string[] = [];
      Array.from(
        (<HTMLSelectElement>document.getElementById('enabled-relay')).options,
      ).forEach((option) => {
        newRelays.push(option.value);
      });
      //改めてリレーに繋ぎ直す
      subsBase.close();
      subsBase = connectRelay(newRelays);
    }
  }
})();
