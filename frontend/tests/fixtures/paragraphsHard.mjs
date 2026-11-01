// A harder, held-out set: words that differ between the scripts (Hindi synonyms), a reordered sentence, extra words in one version,
// Arabic phrases split differently. Groups: "ro|ur|hi" ; an empty cell means that script has no such group (an extra word).
// Optional per-paragraph reorder: { hi: [group indexes in the order they appear in the Hindi text] }.
const P = (s, order = {}) => ({ groups: s.trim().split("\n").map((l) => l.split("|").map((x) => x.trim())), order });
export const HARD = [
P(`
Ilm|علم|ज्ञान
hasil karna|حاصل کرنا|प्राप्त करना
har|ہر|हर
musalman|مسلمان|मुसलमान
ka|کا|का
farz|فرض|कर्तव्य
hai|ہے|है
chahe|چاہے|चाहे
mard|مرد|पुरुष
ho|ہو|हो
ya|یا|या
aurat.|عورت۔|स्त्री।
Is ke liye|اس کے لیے|इसके लिए
insan|انسان|इंसान
ko|کو|को
sabr|صبر|धैर्य
aur|اور|और
mehnat|محنت|मेहनत
ki|کی|की
zaroorat|ضرورت|ज़रूरत
hoti hai.|ہوتی ہے۔|होती है।
`),
P(`
Allah|اللہ|अल्लाह
ne|نے|ने
Quran|قرآن|क़ुरआन
ko|کو|को
Ramzan|رمضان|रमज़ान
ke|کے|के
mahine|مہینے|महीने
mein|میں|में
||ही
nazil kiya.|نازل کیا۔|उतारा।
Isi liye|اسی لیے|इसीलिए
is|اس|इस
mahine|مہینے|महीने
mein|میں|में
Quran|قرآن|क़ुरआन
ki|کی|की
tilawat|تلاوت|तिलावत
ka|کا|का
khaas|خاص|ख़ास
ehtimam|اہتمام|एहतमाम
kiya jata hai.|کیا جاتا ہے۔|किया जाता है।
`, { hi: [4, 5, 6, 7, 8, 0, 1, 2, 3, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] }),
P(`
Rasoolullah sallallahu alaihi wasallam|رسول اللہ صلی اللہ علیہ وسلم|रसूलुल्लाह सल्लल्लाहु अलैहि व सल्लम
ne|نے|ने
farmaya|فرمایا|फ़रमाया
ke|کہ|कि
tum|تم|तुम
mein|میں|में
behtareen|بہترین|बेहतरीन
wo|وہ|वो
hai|ہے|है
jo|جو|जो
Qur'an|قرآن|क़ुरआन
seekhe|سیکھے|सीखे
aur|اور|और
sikhaye.|سکھائے۔|सिखाए।
`),
P(`
Hadees|حدیث|हदीस
ki|کی|की
kitabon|کتابوں|किताबों
mein|میں|में
bohat si|بہت سی|बहुत सी
riwayaat|روایات|रिवायात
milti hain|ملتی ہیں|मिलती हैं
jin ki|جن کی|जिनकी
sanad|سند|सनद
par|پر|पर
ulama ne|علماء نے|उलमा ने
kaafi|کافی|काफ़ी
kaam|کام|काम
kiya hai.|کیا ہے۔|किया है।
Is|اس|इस
mehnat|محنت|मेहनत
ki wajah se|کی وجہ سے|की वजह से
aaj|آج|आज
hum|ہم|हम
sahih|صحیح|सहीह
aur|اور|और
zaeef|ضعیف|ज़ईफ़
riwayaat|روایات|रिवायात
mein|میں|में
farq|فرق|फ़र्क़
kar sakte hain.|کر سکتے ہیں۔|कर सकते हैं।
`),
P(`
Namaz|نماز|नमाज़
ke baad|کے بعد|के बाद
dua|دعا|दुआ
mangna|مانگنا|माँगना
ek|ایک|एक
aisa|ایسا|ऐसा
masla|مسئلہ|मसला
hai|ہے|है
jis par|جس پر|जिस पर
aksar|اکثر|अक्सर
log|لوگ|लोग
behas|بحث|बहस
karte hain.|کرتے ہیں۔|करते हैं।
Kuch|کچھ|कुछ
log|لوگ|लोग
isay|اسے|इसे
zaroori|ضروری|ज़रूरी
samajhte hain|سمجھتے ہیں|समझते हैं
jabke|جبکہ|जबकि
kuch|کچھ|कुछ
log|لوگ|लोग
isay|اسے|इसे
sirf|صرف|सिर्फ़
jaiz|جائز|जाइज़
kehte hain.|کہتے ہیں۔|कहते हैं।
`),
];
