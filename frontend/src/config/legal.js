/**
 * Text of the About, Disclaimer and Privacy pages. UI text on this site is Roman, so these are too.
 *
 * Each page: {
 *   title,
 *   intro:    [paragraph, ...]            (optional, shown under the title)
 *   sections: [{ h, p: [paragraph, ...], list: [item, ...] }]   (p and list are optional)
 *   updated:  "…"                         (optional, small line at the bottom)
 * }
 */
export const TAGLINE = "Fahm-e-Salaf — Quran • Sunnah • Ahle Hadees";

export const LEGAL = {
  about: {
    title: "Hamare Baare Mein",
    intro: [
      "Fahm-e-Salaf (فہمِ سلف) ek Islami tahqiqi platform hai jiska maqsad Quran aur Sahih Sunnat ko Salaf-us-Saliheen ke fahm ke mutabiq samajhna, samjhana aur daleel ke saath pesh karna hai.",
      "Is website par Aqeedah, Masail aur doosre Islami mauzu'at se muta'alliq tahqiqi articles pesh kiye jate hain. Hamari koshish hai ke har mauzu ko Qurani ayaat, Ahadith aur mu'tabar Islami kutub ke hawalon ke saath samne laya jaye.",
    ],
    sections: [
      {
        h: "Hamara Maqsad",
        p: ["Fahm-e-Salaf ka bunyadi maqsad:"],
        list: [
          "Quran aur Sahih Sunnat ki daleel ko wazeh andaaz mein pesh karna.",
          "Salaf-us-Saliheen ke fahm aur manhaj ko samne rakhna.",
          "Sahih Aqeedah aur Sunnat se muta'alliq ilm ko aam karna.",
          "Mukhtalif aqeedah aur masail mein pesh ki jane wali daleelon ka ilmī jaiza lena.",
          "Quran-o-Sunnat aur Fahm-e-Salaf ke khilaf pesh ki jane wali daleelon aur shubuhat ka daleel ke saath radd pesh karna.",
          "Readers ko asal references aur sources tak pahunchne mein madad dena.",
        ],
      },
      {
        h: "Hamari Tahqiq ka Andaaz",
        p: [
          "Fahm-e-Salaf par kisi mauzu par baat karte hue bunyadi tawajjoh daleel par hoti hai.",
          "Jahan kisi mauzu ke hawale se mukhalif rai ya daleel maujood ho, wahan uska jaiza Quran, Sahih Sunnat aur Salaf-us-Saliheen ke fahm ki roshni mein liya jata hai. Zaroorat ke mutabiq mukhalif daleel ki tashreeh, tajziya aur radd bhi pesh kiya jata hai.",
          "Hamari koshish shakhsiyat par tanqeed karna nahi, balki galat daleel ya ghalat fahm ka ilmī jaiza aur radd pesh karna hai.",
        ],
      },
      {
        h: "References",
        p: [
          "Articles mein mumkin had tak asal sources aur references pesh kiye jate hain, jin mein kutub ke naam, musannif, jild, safha aur doosri zaroori maloomat shamil ho sakti hain.",
          "Hamari koshish hai ke reader sirf hamari baat par iktifa na kare, balki asal reference tak bhi pahunch sake.",
        ],
      },
      {
        h: "Hamara Manhaj",
        p: [
          "Fahm-e-Salaf Quran, Sahih Sunnat aur Salaf-us-Saliheen ke fahm ko deen ko samajhne ka bunyadi usool maanta hai.",
          "Allah Ta'ala humein Haq ko Haq samajhne, uski pairwi karne aur Baatil ko Baatil samajhne aur usse bachne ki taufeeq ata farmaye.",
        ],
      },
    ],
  },

  disclaimer: {
    title: "Disclaimer",
    intro: [
      "Fahm-e-Salaf par maujood content ka maqsad Quran, Sahih Sunnat aur Fahm-e-Salaf ki roshni mein Islami ilm, tahqiq aur daleel ko pesh karna hai.",
      "Website par Aqeedah aur Masail se muta'alliq articles ke zariye sahih daleel ko wazeh kiya ja sakta hai aur mukhalif ya Baatil aqeede, rai, daleel aur shubuhat ka ilmī jaiza aur radd bhi pesh kiya ja sakta hai.",
    ],
    sections: [
      {
        h: "Daleel aur Ilmī Radd",
        p: [
          "Fahm-e-Salaf ka maqsad kisi shakhs ki zaat ya personal zindagi par hamla karna nahi, balki mauzu se muta'alliq daleel ka jaiza, tajziya aur radd pesh karna hai.",
          "Jahan kisi rai ko Quran-o-Sunnat aur Fahm-e-Salaf ke khilaf samjha jata hai, wahan uske khilaf daleel pesh karna aur uska radd karna website ke tahqiqi maqsad ka hissa hai.",
        ],
      },
      {
        h: "References",
        p: [
          "Articles mein Qurani ayaat, Ahadith aur Islami kutub ke references pesh kiye ja sakte hain. Hum references aur content ki jaanch ki mumkin koshish karte hain, lekin insani ghalati ka imkan baqi rehta hai.",
          "Agar kisi article mein reference, quotation, translation ya kisi doosri maloomat mein ghalati nazar aaye to humein muttala kiya ja sakta hai, taake uski dobara jaanch ki ja sake.",
        ],
      },
      {
        h: "Zaati Fatwa ka Badal Nahi",
        p: [
          "Fahm-e-Salaf ka content tahqiqi aur taleemi maqsad ke liye hai. Kisi shakhs ke khaas zaati halaat se muta'alliq shar'i hukm ya fatwa hasil karne ke liye qualified aur mu'tabar Aalim se ruju karna chahiye.",
        ],
      },
      {
        h: "External Sources",
        p: [
          "Website par diye gaye external links ya references mazeed maloomat aur asal sources tak rasai ke liye ho sakte hain. External websites ke content aur unki apni policies ki zimmedari Fahm-e-Salaf par nahi hogi.",
        ],
      },
      {
        h: "Content mein Tabdeeli",
        p: [
          "Fahm-e-Salaf kisi bhi waqt apne published content ko update, correct, modify ya remove kar sakta hai, khaas taur par jab kisi reference ya tahqiq ke hawale se mazeed wazahat samne aaye.",
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    intro: [
      "Fahm-e-Salaf (فہمِ سلف) aapki privacy ka ehtiram karta hai. Ye Privacy Policy batati hai ke website ke istemal ke dauran information aur technical data ke hawale se hamara approach kya hai.",
      "Fahm-e-Salaf ka bunyadi maqsad Quran, Sahih Sunnat aur Fahm-e-Salaf ki roshni mein Islami tahqiq aur daleel ko logon tak pahunchana hai.",
    ],
    sections: [
      {
        h: "Public Website",
        p: [
          "Fahm-e-Salaf ke public research articles aur ilmī content ko padhne ke liye aam users ke liye account banana zaroori nahi hai.",
          "Website par Aqeedah, Masail aur doosre mauzu'at ke articles, daleel, references aur mukhalif daleelon ke ilmī jaize aur radd se muta'alliq content available ho sakta hai.",
        ],
      },
      {
        h: "Information",
        p: [
          "Website ke public istemal ke dauran technical operation, security aur website ki functionality ke liye zaroori information process ho sakti hai.",
          "Hum personal information ko sirf us maqsad ke liye istemal karne ki koshish karte hain jiske liye woh website ke kisi feature ke zariye provide ki gayi ho.",
        ],
      },
      {
        h: "Local Storage aur Preferences",
        p: [
          "Website kuch preferences ko browser ke local storage ya similar browser mechanisms mein save kar sakti hai, jaise language selection ya doosri user preferences.",
          "Iska maqsad website ki functionality aur user experience ko behtar banana hai.",
        ],
      },
      {
        h: "Third-Party Services aur Links",
        p: [
          "Website par YouTube, Instagram, WhatsApp ya doosri external services ke links diye ja sakte hain. In services par jane ke baad unki apni privacy policies aur data practices lagu ho sakti hain.",
          "Fahm-e-Salaf third-party websites ki privacy practices ka zimmedar nahi hai.",
        ],
      },
      {
        h: "Security",
        p: [
          "Hum website aur available information ko unauthorized access, misuse aur security threats se bachane ke liye munasib technical measures istemal karne ki koshish karte hain.",
          "Lekin internet par kisi bhi system ki security ki 100% guarantee nahi di ja sakti.",
        ],
      },
      {
        h: "Privacy Policy mein Tabdeeli",
        p: [
          "Website ke features, services ya technical setup mein tabdeeli ke saath is Privacy Policy ko bhi update kiya ja sakta hai. Updated version isi page par publish kiya jayega.",
        ],
      },
    ],
    updated: "Aakhri Update: 5 Oct, 2026",
  },
};
