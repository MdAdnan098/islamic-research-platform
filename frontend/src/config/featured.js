/**
 * Fallback for the home page Ayat / Hadith cards, used ONLY when no published
 * article contains a `quote` block with kind "ayat" / "hadith".
 * (Backend has no "featured" endpoint; admin-driven content always wins.)
 */
export const FEATURED_FALLBACK = {
  ayat: {
    text: "وَمَا آتَاكُمُ الرَّسُولُ فَخُذُوهُ وَمَا نَهَاكُمْ عَنْهُ فَانتَهُوا",
    source: "Surah Al-Hashr 59:7",
    translation: {
      roman: "Aur Rasool tumhein jo kuchh de use le lo, aur jis se rok de us se ruk jao.",
      hindi: "और रसूल तुम्हें जो कुछ दें उसे ले लो, और जिस से रोक दें उस से रुक जाओ।",
      urdu: "اور رسول تمہیں جو کچھ دیں اسے لے لو، اور جس سے روک دیں اس سے رک جاؤ۔",
    },
  },
  hadith: {
    text: "مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ",
    source: "Sahih Bukhari 2697 · Sahih Muslim 1718",
    translation: {
      roman: "Jis ne hamare is deen mein koi aisi cheez nikali jo is mein se nahi, wo mardood hai.",
      hindi: "जिस ने हमारे इस दीन में कोई ऐसी चीज़ निकाली जो इस में से नहीं, वह मर्दूद है।",
      urdu: "جس نے ہمارے اس دین میں کوئی ایسی چیز نکالی جو اس میں سے نہیں، وہ مردود ہے۔",
    },
  },
};
