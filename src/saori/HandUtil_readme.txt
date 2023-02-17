―ＨａｎｄＵｔｉｌ　ＳＡＯＲＩ―

【機能】

（１）ＦＭＯ読み取り

Argument0　　"GetFMO"
Argument1　　FMO名称 　　　　省略可能（既定値"Sakura"）
Argument2　　無視するエントリ（※）
Argument3　　同上（※）以下Argument4,5…とつづく

※ここで指定した文字列を含むエントリは結果として返されなくなります

Result　　エントリ数
Value[n]　FMOの各エントリを１エントリ１Valueで返す


（２）SAKURA APIコール

Argument0　　"SakuraAPI"
Argument1　　投げ先のHWND
Argument2　　wparam
Argument3　　lparam

Result　　SendMessageの結果


（３）Collision位置取得（同時にウィンドウ矩形取得）

（この関数は SAKURA APIを使って Collision位置を取得します）

Argument0　　"GetRect"
Argument1　　投げ先のHWND
Argument2　　"head"|"face"|"bust"　※２

Result　Collision位置のleft（０なら失敗※１）
Value0　Collision位置のleft
Value1　Collision位置のtop
Value2　Collision位置のright
Value3　Collision位置のbottom
Value4　対象HWNDのleft
Value5　対象HWNDのtop
Value6　対象HWNDのright
Value7　対象HWNDのbottom

※１：Collisionが定義されていなかったりSSPの一時起動ゴーストだったり
　　　そもそも相手がCROW（SAKURA API未実装）だったりすると０が帰るみたいです。

※２：ここで３種類以外の文字列を指定すると、SAKURA APIを投げずに
　　　Value4～7のみ返します。また、この場合はResultはValue4と同じ値になります。
　　　これを利用して、自分自身のHWNDを投げることにより自分の位置が分かります。

※2004/7/24追加：投げ先のHWNDがウィンドウで無い場合
　(IsWindowで失敗した場合）リザルトで-9999が帰ります。
※2005/7/12追加：投げ先のHWNDが可視で無い場合
　(IsWindowVisibleで失敗した場合）リザルトで-9999が帰ります。


（４）DirectSSTP送信

Argument0　　"DSSTPSend"
Argument1　　投げ先のHWND
Argument2　　戻り値が要る場合は"result"
Argument3～　SSTPの各行
（以下同様に続ける、特に上限なし、但しメッセージ自体が1KBytes以内であること）
※DirectSSTPのHWNDパラメータは勝手に追加されますので指定は不要です。

Result　SSTPサーバの返した行数、送信に失敗したり結果を返されなかった場合は
　　　　０が返る（ちなみに送信待ち時間、結果待ち時間は３秒です）

Value0～　SSTPサーバの返した各行が入る、ただし空行は除去します。
（たいていの場合、Value0は SSTP/1.4 200 OK といったリザルトコード行、
　その後Value1から実際のデータが（もしあれば）返る筈です）


（５）ウィンドウ移動

Argument0　　"MoveWindow"
Argument1　　投げ先のHWND
Argument2　　X座標
Argument3　　Y座標

Result　書式が間違っていなければ200が返ります。

（６）だっこ

Argument0　　"Dakko"
Argument1　　"START"|"STOP"
Argument2　　基準となるHWND1
Argument3　　抱っこさせるHWND2
Argument4　　X座標差分
Argument5　　Y座標差分
Argument6　　監視間隔（ミリ秒）

Result　書式が間違っていなければ200が返ります。

HWND1にHWND2をひっつけます。（監視間隔で位置を監視、HWND1の左上座標に
差分を加えた値を HWND2の左上座標にします）
STARTを使うと監視を開始します。STARTは何回呼んでもかまいません。
STOPを使うと監視を終了します。
STOPを使う場合はArgument2～6は無くてかまいません。

監視中にHWND1がIsWindowで無くなった場合は、OnDakkoLost NOTIFYを
HWND2に対して投げます。（STOPはされません）

【履歴】

2004/05/08	Ver1.0.0	新規作成
2004/05/08	Ver1.0.1	Notify1.0にバグがあったので修正
2004/05/08	Ver1.0.3	nodummyの際、CROW,S-V,SSSBのエントリを無視するよう修正
2004/05/08	Ver1.0.4	nodummyオプション廃止、無視するエントリを明示指定するようにしました
						自分自身の位置を取得できるようにGetRectの仕様を修正しました。
2004/05/16	Ver1.1.0	"Notify"廃止、より汎用的な"DSSTPSend"追加。
2004/06/14	Ver1.2.0	"MoveWindow"追加。
2004/07/24	Ver1.2.1	"MoveWindow"リザルトコード変更。
2004/07/25	Ver1.3.0	"Dakko"追加。
2005/05/10	Ver1.3.1	終了処理を若干見直し。これで安定するといいけど。
2005/05/12	Ver1.3.2	"Dakko"でエンバグしてたので修正。"Dakko"にOnDakkoLost追加。
2005/07/12	Ver1.3.2.1	"GetFmo"のエンバグを修正。"GetRect"でIsWindowVisible追加。
2005/07/26	Ver1.3.3	SSTP送信時に落ちる場合があるバグを修正。Thanks to ぽにゃん
2008/04/14	Ver1.4.1	Argumentが順番どおりに来なくても大丈夫なようにした（for KAWARI827)
2011/05/05	Ver1.4.2	"Dakko"を切削魔神C.Ponapaltさんが直してくれました。


【謝辞】

開発にあたってはえびさわ様のgethwnd.dllソースを大いに参考にさせて頂き、
また勝手ながらだいぶ流用させて頂いております。お礼申し上げます。
＞http://www33.tok2.com/home/ebi/index.shtml　何かぬるめの... 

【連絡先】

連絡先が変わりました。
----------------------------------
浮　子　屋
----------------------------------
 
 http://ukiya.sakura.ne.jp/
----------------------------------
