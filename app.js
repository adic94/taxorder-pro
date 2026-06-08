// ==================== DATA ====================
const VEHICLES = [{"nrRej":"WGM87205","marka":"Fuso","model":"Canter 9/18","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":8500,"euro":"EURO 6","vin":"TYBFECX1ELDC03229","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WU6647K","marka":"Fuso","model":"Canter 7/15","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":7500,"euro":"EURO 6","vin":"TYBFEB71ELDC04538","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM89755","marka":"Fuso","model":"Canter 7/15 BR","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":7500,"euro":"EURO 6","vin":"TYBFEB71ELDC04728","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WL3597R","marka":"Fuso","model":"Canter 7/15","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":7500,"euro":"EURO 6","vin":"TYBFEB71ELDC07336","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WW024AF","marka":"GFOLLNER","model":"APL 2/4 TL","rok":2015,"typ":"Przyczepa","dmc":14000,"euro":"","vin":"VASAL214YFGPA8689","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WA5535C","marka":"Iveco","model":"EUROCARGO ML75E15","rok":2006,"typ":"CiÄ™ĹĽarowy","dmc":7500,"euro":"EURO 3","vin":"ZCFA75B0202483032","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM0065L","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXRY456838","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ124HW","marka":"MAN","model":"TGE 6.160 5.5T","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ7R9018317","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ122HW","marka":"MAN","model":"TGE 6.160 5.5T","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ2R9018256","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ123HW","marka":"MAN","model":"TGE 6.160 5.5T","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ9R9018285","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ389HM","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXRP250540","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ390HM","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9RP250481","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL7611V","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXRP250487","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL7602V","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9RP250769","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8172K","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"","vin":"WMA12DZZ1R9250457","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ495HU","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ5RP252776","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ496HU","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1RP244920","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ883KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"","vin":"WMA12DZZ3SP315203","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ884KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"","vin":"WMA12DZZ4SP315257","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ882KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"","vin":"WMA12DZZ5SP315221","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ881KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ2SP315998","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ320KA","marka":"MAN","model":"TGM 4X4-G","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":11990,"euro":"EURO 6","vin":"WMA36DZZ6RP277456","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ321KA","marka":"MAN","model":"TGM 4X4-G","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":11990,"euro":"EURO 6","vin":"WMA36DZZ2RP277518","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ322KA","marka":"MAN","model":"TGM 4X4-G","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":11990,"euro":"EURO 6","vin":"WMA36DZZ9RP277824","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8572M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ4SP315226","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8573M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ2SP315371","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8574M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ4SP315243","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8575M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ4SP315209","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR7520T","marka":"MAN","model":"TGE 6.160 5.5T","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ2R9007581","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR7519T","marka":"MAN","model":"TGE 6.160 5.5T","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ8R9006457","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM0473H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ2NY443995","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM0472H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1NY443986","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4921H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ8PY444152","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4922H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9NY443945","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM5469H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1PY448110","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM6162J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ0PY452892","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM6163J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ7PY453389","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4268J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9PY452938","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4269J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ5PY453424","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ521GG","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ3PY452935","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ520GG","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ3PY453275","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ497GH","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1PY453288","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ496GH","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ3PY453292","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WA5790C","marka":"MAN","model":"TGL 8","rok":2010,"typ":"CiÄ™ĹĽarowy","dmc":7500,"euro":"EURO 5","vin":"WMAN03ZZ5AY247514","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WW1670X","marka":"MAN","model":"18.225 LC","rok":2003,"typ":"CiÄ™ĹĽarowy","dmc":16000,"euro":"EURO 3","vin":"WMAL87ZZZ3Y113513","status":"WynajÄ™ty","wlasciciel":"KJR Supply"},{"nrRej":"WGM4903C","marka":"MAN","model":"TGL 8.190-G","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ0MY430077","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4904C","marka":"MAN","model":"TGL 8.190-G","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ6MY430083","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR5174P","marka":"MAN","model":"TGE 6.180 5,5T","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ9M9016738","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR5173P","marka":"MAN","model":"TGE 6.180 5,5T","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ2M9016001","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM2174H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXPY444086","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM2175H","marka":"MAN","model":"TGL 8.190-G","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9NY443931","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ084KP","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZXT9002765","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ807KL","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ1S9030842","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ806KL","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ3S9024220","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ805KL","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ1S9024829","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ209LJ","marka":"Meprozet","model":"PN-1 asenizacyjna","rok":2025,"typ":"Przyczepa","dmc":16200,"euro":"","vin":"250480012","status":"WynajÄ™ty","wlasciciel":"GCON"},{"nrRej":"WZ274KL","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33ZXTN354520","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ273KL","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z8TN355150","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ694KR","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z7TN355897","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ724KP","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z6TN356071","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL9652T","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N221239","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL9625T","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N215193","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WU7721N","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310591672","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ695FE","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310591671","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ732FE","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N193696","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL6049T","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601267","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ960FF","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601266","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ961FF","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601265","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ962FF","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601264","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ093EV","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310582526","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ619EY","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310582527","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ620EY","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310583288","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ952EP","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532645","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ748EY","marka":"Mercedes","model":"Sprinter 5.5T 4X4","rok":2017,"typ":"CiÄ™ĹĽarowy","dmc":5000,"euro":"EURO 6","vin":"WDB9061531N745826","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WZ953EP","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532644","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ951EP","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532253","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ369EH","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532254","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WU6528M","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N141543","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ931CV","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N141086","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ930CV","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N141313","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ929CV","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N143606","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM9423A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310509057","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM9424A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310509401","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM2116C","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516336","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WL8328R","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516337","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WZ971CS","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516335","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ336CR","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516338","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ493CU","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N140067","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL1814U","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N140624","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ491CU","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N145584","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ772CK","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310504315","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM9630A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310510109","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM9629A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310510110","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL4505R","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310496511","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM91914","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310461203","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM95870","marka":"Mercedes","model":"Sprinter 5.5T BR","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104169","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM95867","marka":"Mercedes","model":"Sprinter 5.5T BR","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N106207","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WB2860V","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N105969","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WB2985V","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104399","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WL8251P","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310469256","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WB8489U","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N092173","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM89756","marka":"Mercedes","model":"Sprinter 5.5T BR","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N093755","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM91975","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N103276","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM92044","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467667","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM91998","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N103480","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM89010","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467074","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WL6526P","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467945","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WL6527P","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467944","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM93611","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467816","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM93664","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467817","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM93535","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104398","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM93534","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104628","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WGM84083","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"WDB96702310423253","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WW715AR","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310437502","status":"WynajÄ™ty","wlasciciel":"GCON"},{"nrRej":"WB6684U","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N091252","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WWL5562K","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N054964","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WW7846Y","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N054963","status":"WynajÄ™ty","wlasciciel":"GCON"},{"nrRej":"WWL2203L","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N056333","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WWL5561K","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N056074","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ518GG","marka":"Mercedes","model":"Atego 2-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702210663640","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ519GG","marka":"Mercedes","model":"Atego 2-G","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702410663641","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL6680U","marka":"Mercedes","model":"Atego 2-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702610663639","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL6681U","marka":"Mercedes","model":"Atego 2-M","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702410663638","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ726GP","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z6PN245154","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ227FT","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N223371","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ226FT","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N213977","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ428FL","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601263","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ846FL","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N196127","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ266FT","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N223979","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ264FT","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2022,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N215197","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ594GW","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2023,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z4RN269312","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL4360X","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702810823343","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ872KC","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702110823345","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ871KC","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702X10823344","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WE5HX36","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702610823342","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ481KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702210821314","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ479KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702510823624","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ480KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702010821313","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ471KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702510821534","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ232HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702510769726","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ234HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310769725","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ230HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702110769724","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ231HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702210770333","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ233HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702010770332","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ235HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702710770005","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ236HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702410770334","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM0867L","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z1RN308048","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ121HW","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33ZXRN307061","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ120HW","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2024,"typ":"CiÄ™ĹĽarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z8RN302067","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WA8920J","marka":"Mercedes","model":"Atego 4X4","rok":2011,"typ":"CiÄ™ĹĽarowy","dmc":10500,"euro":"EURO 5","vin":"WDB9763331L548244","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WA9885J","marka":"Mercedes","model":"Actros","rok":2016,"typ":"CiÄ™ĹĽarowy","dmc":26000,"euro":"","vin":"WDB96302010057230","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WW239AF","marka":"Pronar","model":"T679/3 wywrotka","rok":2026,"typ":"Przyczepa","dmc":11400,"euro":"","vin":"SZB6793XXT1X00315","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WW564AJ","marka":"Scania","model":"R520","rok":2015,"typ":"CiÄ™ĹĽarowy","dmc":26000,"euro":"EURO 6","vin":"YS2R6X20005391826","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ621FY","marka":"Scania","model":"R580","rok":2015,"typ":"CiÄ™ĹĽarowy","dmc":30000,"euro":"EURO 6","vin":"YS2R6X20005388005","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WA0677L","marka":"Scania","model":"R490 Szambiarka","rok":2017,"typ":"CiÄ™ĹĽarowy","dmc":27000,"euro":"EURO 6","vin":"YS2R6X20005482489","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WA4789F","marka":"Scania","model":"R540 Wodolejka","rok":2021,"typ":"CiÄ™ĹĽarowy","dmc":27000,"euro":"EURO 6","vin":"YS2R8X40002177169","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WW117AF","marka":"Sonst","model":"ANH. Hersteller","rok":2016,"typ":"Przyczepa","dmc":18000,"euro":"","vin":"W09TP28471A006V08","status":"WynajÄ™ty","wlasciciel":"GCON"},{"nrRej":"WA1697F","marka":"Volvo","model":"FMX 8x4","rok":2011,"typ":"CiÄ™ĹĽarowy","dmc":32000,"euro":"EURO 5","vin":"YV2JG20G9BA714219","status":"WĹ‚asny","wlasciciel":"mToilet"},{"nrRej":"WA2609J","marka":"Volvo","model":"FH 540 Szambiarka","rok":2020,"typ":"CiÄ™ĹĽarowy","dmc":32000,"euro":"EURO 6","vin":"YV2RT60G2KA853081","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ899GJ","marka":"Volvo","model":"FMX 6x2","rok":2016,"typ":"CiÄ™ĹĽarowy","dmc":28000,"euro":"EURO 6","vin":"YV2XT60C0GA789117","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ464FY","marka":"Volvo","model":"FH 540 Wodolejka","rok":2018,"typ":"CiÄ™ĹĽarowy","dmc":32000,"euro":"EURO 6","vin":"YV2RT60C5JA833371","status":"WĹ‚asny","wlasciciel":"mToilet"}];

// State
let vehs = VEHICLES.map((v,i) => ({...v, id:i, osie: v.dmc>=12000?3:2, zawieszenie:'pneumatyczne', dmcZespolu:0, miesiacePodatku:12}));
let selected = new Set();
let sortKey = 'nrRej', sortAsc = true;

// ==================== RATES (Warszawa 2026) ====================
function getRate(v) {
  const dT=v.dmc/1000, dzT=(v.dmcZespolu||0)/1000, refZ=dzT>0?dzT:dT;
  const typ=(v.typ||'').toLowerCase(), osie=parseInt(v.osie)||2, rok=parseInt(v.rok)||0, isNew=rok>=2024;
  if(typ.includes('autobus')) return isNew?1320:(parseInt(v.miejsca)||0)<30?1488:1872;
  if(typ.includes('naczepa')||typ.includes('przyczepa')) {
    if(refZ>=7&&refZ<12) return isNew?1128:1248;
    if(refZ>=12) {
      if(osie===1){if(refZ<18)return 744;if(refZ<25)return 840;if(refZ<=36)return 984;return 1128;}
      if(osie===2){if(refZ<28)return 1488;if(refZ<33)return 1776;if(refZ<38)return 2256;return 2976;}
      if(refZ<=36)return 1872;if(refZ<38)return 2040;return 2232;
    }
    return null;
  }
  if(typ.includes('ciÄ…gnik')||typ.includes('ciagnik')) {
    if(refZ>=3.5&&refZ<12) return isNew?1248:1392;
    if(refZ>=12) {
      if(osie<=2){if(refZ<18)return 1128;if(refZ<25)return 1680;if(refZ<31)return 2232;if(refZ<=36)return 3384;return 3384;}
      if(refZ<=36)return 2784;if(refZ<40)return 2832;return 4200;
    }
    return null;
  }
  if(dT<=3.5) return null;
  if(dT<12) { if(isNew){if(dT<=5.5)return 744;if(dT<=9)return 1008;return 1344;} if(dT<=5.5)return 840;if(dT<=9)return 1128;return 1488; }
  if(osie===2){if(dT<13)return 1200;if(dT<14)return 1488;if(dT<15)return 1680;return 2184;}
  if(osie===3){if(dT<17)return 1488;if(dT<19)return 1704;if(dT<21)return 1872;if(dT<23)return 2136;return 2760;}
  if(dT<25)return 1488;if(dT<27)return 1824;if(dT<29)return 2880;return 4296;
}

function getCat(v) {
  const dT=v.dmc/1000, dzT=(v.dmcZespolu||0)/1000, refZ=dzT>0?dzT:dT;
  const typ=(v.typ||'').toLowerCase(), osie=parseInt(v.osie)||2;
  if(typ.includes('autobus')) return (parseInt(v.miejsca)||0)<22?'D6':'D7';
  if(typ.includes('naczepa')||typ.includes('przyczepa')) {
    if(refZ>=12) return osie===1?'D13':osie===2?'D14':'D15';
    if(refZ>=7) return 'D5';
    return null;
  }
  if(typ.includes('ciÄ…gnik')||typ.includes('ciagnik')) {
    if(refZ>=12) return osie<=2?'D11':'D12';
    if(refZ>=3.5) return 'D4';
    return null;
  }
  if(dT<=3.5) return null;
  if(dT>=12) return osie===2?'D8':osie===3?'D9':'D10';
  if(dT<=5.5) return 'D1'; if(dT<=9) return 'D2'; if(dT<12) return 'D3';
  return null;
}

function calcTax(v) {
  const cat = getCat(v); if(!cat) return {cat:null,amount:0,rate:0};
  const rate = getRate(v)||0;
  const m = parseInt(v.miesiacePodatku)||12;
  return {cat, amount: Math.round((rate*m)/12*100)/100, rate, isNew: (parseInt(v.rok)||0)>=2024};
}

const CAT_COLORS = {D1:'pill-blue',D2:'pill-green',D3:'pill-amber',D4:'pill-amber',D5:'pill-green',D6:'pill-blue',D7:'pill-blue',D8:'pill-red',D9:'pill-red',D10:'pill-red',D11:'pill-red',D12:'pill-red',D13:'pill-amber',D14:'pill-amber',D15:'pill-amber'};
const CAT_LABELS = {D1:'Sam.ciÄ™ĹĽ. 3,5â€“5,5t',D2:'Sam.ciÄ™ĹĽ. 5,5â€“9t',D3:'Sam.ciÄ™ĹĽ. 9â€“12t',D4:'CiÄ…gnik <12t',D5:'Przyczepa 7â€“12t',D6:'Autobus <22m.',D7:'Autobus â‰Ą22m.',D8:'CiÄ™ĹĽarowy â‰Ą12t 2os.',D9:'CiÄ™ĹĽarowy â‰Ą12t 3os.',D10:'CiÄ™ĹĽarowy â‰Ą12t 4+',D11:'CiÄ…gnik â‰Ą12t 2os.',D12:'CiÄ…gnik â‰Ą12t 3+',D13:'Przyczepa â‰Ą12t 1oĹ›',D14:'Przyczepa â‰Ą12t 2os.',D15:'Przyczepa â‰Ą12t 3+'};
const STAT_LABELS = {WĹ‚asny:'pill-green',Leasing:'pill-blue',WynajÄ™ty:'pill-amber'};

function fmt2(n) { return Number(n).toFixed(2).replace('.',','); }
function fmtZl(n) { return Math.round(n).toLocaleString('pl-PL'); }
function fmtT(kg) { return kg?(kg/1000).toFixed(3).replace('.',','):'â€”'; }

// ==================== NAVIGATION ====================
function showPage(id) {
  if(typeof saveCompanyState === 'function') saveCompanyState();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tnb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  const tnb = document.getElementById('tnb-'+id);
  if(tnb) tnb.classList.add('active');
  if(id==='pojazdy') renderVeh();
  if(id==='kalkulator') renderKalkulator();
  if(id==='formularze') renderFormularze();
  if(id==='pd') updatePD();
  if(id==='dash') renderDash();
  if(id==='walidacja') { runValidation(); }
  if(id==='raporty') renderRaporty();
  if(id==='ocr') renderOcrHistory();
  if(id==='faktury') renderFakHistory();
  if(id==='pdfexport') updatePdfSummary();
  if(id==='impexp') { document.getElementById('exp-sel-cnt').textContent=selected.size; }
  if(id==='karty') renderKarty();
  if(id==='uzytkownicy') renderUsers();
  if(id==='cepik') initCepikPage();
  if(id==='firmy') {
  if(window.TaxOrderCompaniesReadOnly && typeof window.TaxOrderCompaniesReadOnly.loadAndRenderCompanies === 'function'){
    window.TaxOrderCompaniesReadOnly.loadAndRenderCompanies();
  } else if(typeof renderCompanyOverview==='function') {
    renderCompanyOverview();
  }
}
  updateCounters();
}

// ==================== POJAZDY ====================
function filterVeh() {
  const q = (document.getElementById('q-veh')?.value||'').toLowerCase();
  const fTyp = document.getElementById('f-typ')?.value||'';
  const fStat = document.getElementById('f-status')?.value||'';
  const fWl = document.getElementById('f-wl')?.value||'';
  return vehs.filter(v =>
    (!q || v.nrRej.toLowerCase().includes(q) || v.marka.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || (v.vin||'').toLowerCase().includes(q)) &&
    (!fTyp || v.typ === fTyp) &&
    (!fStat || v.status === fStat) &&
    (!fWl || v.wlasciciel === fWl)
  ).sort((a,b) => {
    let va=a[sortKey]||'', vb=b[sortKey]||'';
    if(typeof va==='number') return sortAsc?va-vb:vb-va;
    return sortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
  });
}

function sortBy(key) {
  if(sortKey===key) sortAsc=!sortAsc; else {sortKey=key;sortAsc=true;}
  renderVeh();
}

function renderVeh() {
  const list = filterVeh();
  const tbody = document.getElementById('veh-tbody');
  if(!tbody) return;
  const isTrailer = v => (v.typ||'').toLowerCase().includes('przy')||(v.typ||'').toLowerCase().includes('nacz');
  tbody.innerHTML = list.map(v => {
    const t = calcTax(v);
    const isSel = selected.has(v.id);
    const isNew = (parseInt(v.rok)||0)>=2024;
    const needsDmcZ = isTrailer(v) && !v.dmcZespolu;
    return `<tr class="${isSel?'row-sel':''}" onclick="toggleRow(${v.id})">
      <td onclick="event.stopPropagation()"><input type="checkbox" ${isSel?'checked':''} onchange="toggleRow(${v.id})"></td>
      <td><strong style="font-family:var(--mono)">${v.nrRej}</strong></td>
      <td><div style="font-weight:500">${v.marka} ${v.model}</div><div style="font-size:11px;color:var(--text2)">${v.euro||'â€”'} Â· ${v.vin||'â€”'}</div></td>
      <td>${v.rok||'â€”'}${isNew?'<span class="pill pill-new" style="margin-left:6px;font-size:9px">Â§2</span>':''}</td>
      <td><span class="pill pill-gray">${v.typ}</span></td>
      <td style="font-family:var(--mono);font-size:12px">${(v.dmc||0).toLocaleString('pl-PL')}</td>
      <td onclick="event.stopPropagation()">
        <select class="isel" onchange="setV(${v.id},'osie',parseInt(this.value))">
          ${[1,2,3,4,5].map(n=>`<option ${v.osie===n?'selected':''}>${n}</option>`).join('')}
        </select>
      </td>
      <td onclick="event.stopPropagation()">
        <select class="isel" style="width:120px" onchange="setV(${v.id},'zawieszenie',this.value)">
          <option ${v.zawieszenie==='pneumatyczne'?'selected':''}>pneumatyczne</option>
          <option ${v.zawieszenie==='rĂłwnowaĹĽne'?'selected':''}>rĂłwnowaĹĽne</option>
          <option ${v.zawieszenie==='inne'?'selected':''}>inne</option>
        </select>
      </td>
      <td onclick="event.stopPropagation()">
        ${isTrailer(v)?`<input class="inum" style="width:70px" type="number" step="0.001" min="0" max="100" value="${(v.dmcZespolu/1000).toFixed(1)}" onchange="setV(${v.id},'dmcZespolu',parseFloat(this.value)*1000||0)" title="DMC zesp. w tonach">${needsDmcZ?'<span style="color:var(--amber);font-size:11px"> âš </span>':''}`:
        '<span style="color:var(--text3)">â€”</span>'}
      </td>
      <td onclick="event.stopPropagation()">
        <input class="inum" type="number" min="1" max="12" value="${v.miesiacePodatku||12}" onchange="setV(${v.id},'miesiacePodatku',parseInt(this.value)||12)">
      </td>
      <td><span class="pill ${STAT_LABELS[v.status]||'pill-gray'}">${v.status}</span></td>
      <td>${t.cat?`<span class="pill ${CAT_COLORS[t.cat]||'pill-gray'}">${t.cat}</span>${needsDmcZ?'<span style="font-size:10px;color:var(--amber)"> brak DMC zesp.</span>':''}`:
        '<span style="color:var(--text3);font-size:11px">â€”</span>'}</td>
      <td style="text-align:right">${t.amount>0?`<strong style="color:var(--green);font-family:var(--mono)">${fmt2(t.amount)} zĹ‚</strong>`:'<span style="color:var(--text3)">â€”</span>'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="13" style="text-align:center;padding:2rem;color:var(--text3)">Brak wynikĂłw</td></tr>`;
  updateCounters();
}

function toggleRow(id) {
  if(selected.has(id)) selected.delete(id); else selected.add(id);
  renderVeh(); updateCounters();
}
function toggleAll(chk) { const list=filterVeh(); if(chk.checked) list.forEach(v=>selected.add(v.id)); else list.forEach(v=>selected.delete(v.id)); renderVeh(); updateCounters(); }
function selAll() { const list=filterVeh(); list.forEach(v=>selected.add(v.id)); renderVeh(); updateCounters(); toast(`â‘ Zaznaczono ${list.length} pojazdĂłw`); }
function deselAll() { selected.clear(); renderVeh(); updateCounters(); toast('â Odznaczono wszystkie'); }
function setV(id,k,val) { const v=vehs.find(x=>x.id===id); if(v){v[k]=val;} renderVeh(); updateCounters(); }

// ==================== KALKULATOR ====================
function getSel() { return vehs.filter(v=>selected.has(v.id)); }
function getSelTax() { return getSel().map(v=>({...v,...calcTax(v)})); }
function totalTax() { return getSelTax().reduce((s,v)=>s+(v.amount||0),0); }

function renderKalkulator() {
  const selT = getSelTax();
  const tbody = document.getElementById('calc-tbody');
  const warn = document.getElementById('warn-no-sel');
  if(!tbody) return;
  if(selT.length===0) { tbody.innerHTML=''; if(warn)warn.classList.remove('hidden'); return; }
  if(warn) warn.classList.add('hidden');
  tbody.innerHTML = selT.map(v => `<tr>
    <td><strong style="font-family:var(--mono)">${v.nrRej}</strong></td>
    <td>${v.marka} ${v.model} <span style="font-size:11px;color:var(--text2)">${v.rok||''}</span></td>
    <td>${v.cat?`<span class="pill ${CAT_COLORS[v.cat]||'pill-gray'}">${v.cat}</span>`:'<span style="color:var(--text3)">â€”</span>'}</td>
    <td style="text-align:center">${v.miesiacePodatku||12}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--text2)">${v.rate?v.rate.toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--green)">${v.amount>0?fmt2(v.amount)+' zĹ‚':'â€”'}</td>
  </tr>`).join('');

  const total = totalTax();
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const taxable = selT.filter(v=>v.cat);
  document.getElementById('ks-count').textContent = selT.length;
  document.getElementById('ks-taxable').textContent = taxable.length;
  document.getElementById('ks-att').textContent = Math.ceil(taxable.length/3)||0;
  document.getElementById('ks-total').textContent = fmt2(total)+' zĹ‚';
  document.getElementById('ks-r1').textContent = fmtZl(r1)+' zĹ‚';
  document.getElementById('ks-r2').textContent = fmtZl(r2)+' zĹ‚';

  // Cat table
  const cats = {};
  selT.forEach(v=>{ if(!v.cat)return; if(!cats[v.cat])cats[v.cat]={count:0,amount:0,rate:v.rate}; cats[v.cat].count++;cats[v.cat].amount+=v.amount; });
  const catEl = document.getElementById('cat-tbody');
  if(catEl) catEl.innerHTML = Object.entries(cats).map(([cat,d])=>`<tr>
    <td><span class="pill ${CAT_COLORS[cat]||'pill-gray'}">${cat}</span></td>
    <td>${CAT_LABELS[cat]||''}</td>
    <td style="text-align:center;font-weight:600">${d.count}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--text2)">${d.rate?d.rate.toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--green)">${fmt2(d.amount)} zĹ‚</td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1rem">Brak pojazdĂłw z kategoriÄ…</td></tr>';
}

// ==================== COUNTERS ====================
function updateCounters() {
  const cnt = selected.size;
  const total = totalTax();
  document.getElementById('badge-sel').textContent = cnt;
  document.getElementById('btn-sel-cnt').textContent = cnt;
  document.getElementById('s-sel').textContent = cnt;
  document.getElementById('s-tax').textContent = fmtZl(total).toLocaleString('pl-PL')+' zĹ‚';
  document.getElementById('s-new').textContent = vehs.filter(v=>selected.has(v.id)&&(parseInt(v.rok)||0)>=2024).length;
  document.getElementById('pd-cnt').textContent = getSelTax().filter(v=>v.cat).length;
  const pdTax = getSelTax().filter(v=>v.cat).reduce((s,v)=>s+(v.amount||0),0);
  const pdEl = document.getElementById('pd-taxable'); if(pdEl) pdEl.textContent = getSelTax().filter(v=>v.cat).length;
  const pdTotalEl = document.getElementById('pd-total'); if(pdTotalEl) pdTotalEl.textContent = fmt2(pdTax)+' zĹ‚';
}

function refreshAll() { renderVeh(); renderKalkulator(); updateCounters(); renderDash(); }
function updateAll() { updateCounters(); renderKalkulator(); }

// ==================== DASH ====================
function renderDash() {
  const brands = {};
  vehs.forEach(v=>{ if(!brands[v.marka])brands[v.marka]=0; brands[v.marka]++; });
  const el = document.getElementById('dash-brands');
  if(el) el.innerHTML = Object.entries(brands).sort((a,b)=>b[1]-a[1]).map(([m,n])=>{
    const cats = new Set(vehs.filter(v=>v.marka===m).map(v=>getCat(v)).filter(Boolean));
    return `<tr><td>${m}</td><td style="font-weight:600">${n}</td><td>${[...cats].map(c=>`<span class="pill ${CAT_COLORS[c]||'pill-gray'}" style="margin-right:3px">${c}</span>`).join('')||'â€”'}</td></tr>`;
  }).join('');
  const newCount = vehs.filter(v=>(parseInt(v.rok)||0)>=2024).length;
  document.getElementById('s-new').textContent = newCount + ' poj.';
  document.getElementById('s-total').textContent = vehs.length;
}

// ==================== FORMULARZE ====================
function tp(id) { return (document.getElementById(id)||{}).value||''; }

function renderFormularze() {
  try {
  const selT = getSelTax();
  const taxable = selT.filter(v=>v.cat);
  const total = totalTax();
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const cats = {};
  selT.forEach(v=>{ if(!v.cat)return; if(!cats[v.cat])cats[v.cat]={count:0,amount:0}; cats[v.cat].count++;cats[v.cat].amount+=v.amount; });
  const groups = [];
  for(let i=0;i<taxable.length;i+=3) groups.push(taxable.slice(i,i+3));
  const yr = document.getElementById('taxYear').value;
  const today = new Date().toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});

  const info = document.getElementById('form-info');
  if(info) info.textContent = `${taxable.length} pojazdĂłw â†’ DT-1(5) + ${groups.length} Ă— DT-1/A(5)`;

  // ===== POMOCNICZE =====
  const tp = id => (document.getElementById(id)||{}).value||'';
  const fv = (val,fallback='') => val||fallback;
  const box = (checked) => checked
    ? '<span style="display:inline-block;width:9px;height:9px;border:1.2px solid #222;vertical-align:middle;background:#fff;position:relative;margin-right:2px"><span style="position:absolute;top:-3px;left:0;font-size:10px;font-family:Arial,sans-serif;font-weight:bold;color:#000">&#10003;</span></span>'
    : '<span style="display:inline-block;width:9px;height:9px;border:1.2px solid #222;vertical-align:middle;background:#fff;margin-right:2px"></span>';

  const catDisplay = cat => String(cat||'').replace(/^D(\d+)$/, 'D.$1');

  // Kategorie D.1-D.15
  const catDefs = [
    ['D1','Samochody ciÄ™ĹĽarowe o dopuszczalnej masie caĹ‚kowitej powyĹĽej 3,5 tony do 5,5 tony wĹ‚Ä…cznie',[20,21,22,23]],
    ['D2','Samochody ciÄ™ĹĽarowe o dopuszczalnej masie caĹ‚kowitej powyĹĽej 5,5 tony do 9 ton wĹ‚Ä…cznie',[24,25,26,27]],
    ['D3','Samochody ciÄ™ĹĽarowe o dopuszczalnej masie caĹ‚kowitej powyĹĽej 9 ton i poniĹĽej 12 ton',[28,29,30,31]],
    ['D4','CiÄ…gniki siodĹ‚owe i balastowe przystosowane do uĹĽywania Ĺ‚Ä…cznie z naczepÄ… lub przyczepÄ… o dopuszczalnej masie caĹ‚kowitej zespoĹ‚u pojazdĂłw od 3,5 tony i poniĹĽej 12 ton',[32,33,34,35]],
    ['D5','Przyczepy i naczepy, ktĂłre Ĺ‚Ä…cznie z pojazdem silnikowym posiadajÄ… dopuszczalnÄ… masÄ™ caĹ‚kowitÄ… od 7 ton i poniĹĽej 12 ton, z wyjÄ…tkiem zwiÄ…zanych wyĹ‚Ä…cznie z dziaĹ‚alnoĹ›ciÄ… rolniczÄ… prowadzonÄ… przez podatnika podatku rolnego',[36,37,38,39]],
    ['D6','Autobusy z liczbÄ… miejsc do siedzenia mniejszÄ… niĹĽ 22',[40,41,42,43]],
    ['D7','Autobusy z liczbÄ… miejsc do siedzenia rĂłwnÄ… i wyĹĽszÄ… niĹĽ 22',[44,45,46,47]],
  ];
  const catDefs2 = [
    ['D8','Dwie osie',[48,49,50,51],'Sam. ciÄ™ĹĽ. â‰Ą12t'],
    ['D9','Trzy osie',[52,53,54,55],'Sam. ciÄ™ĹĽ. â‰Ą12t'],
    ['D10','Cztery osie i wiÄ™cej',[56,57,58,59],'Sam. ciÄ™ĹĽ. â‰Ą12t'],
    ['D11','Dwie osie',[60,61,62,63],'CiÄ…gniki siodĹ‚owe â‰Ą12t'],
    ['D12','Trzy osie i wiÄ™cej',[64,65,66,67],'CiÄ…gniki siodĹ‚owe â‰Ą12t'],
    ['D13','Jedna oĹ›',[68,69,70,71],'Przyczepy i naczepy â‰Ą12t'],
    ['D14','Dwie osie',[72,73,74,75],'Przyczepy i naczepy â‰Ą12t'],
    ['D15','Trzy osie i wiÄ™cej',[76,77,78,79],'Przyczepy i naczepy â‰Ą12t'],
  ];

  const celMap = {
    'DEKLARACJA SKLADANA DO 15 LUTEGO': '1',
    'POWSTANIE OBOWIAZKU W TRAKCIE ROKU': '2',
    'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU': '3',
    'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY': '4',
    'KOREKTA DEKLARACJI': '5',
  };
  const celNr = celMap[tp('tp-cel')] || '1';

  // ====================================================================
  // DT-1(5) â€” FORMULARZ GĹĂ“WNY
  // ====================================================================
  const dt1 = `
  <div class="form-page" style="font-family:'Courier New',Courier,monospace;font-size:7.5pt;background:#fff;color:#000;padding:8mm 10mm;max-width:190mm;margin:0 auto 20px;border:1px solid #888">

    <!-- NAGĹĂ“WEK -->
    <div style="font-size:6pt;border:0.5px solid #000;padding:2px 4px;margin-bottom:2px;display:flex;justify-content:space-between">
      <span>POLA JASNE WYPEĹNIA PODATNIK, POLA CIEMNE WYPEĹNIA ORGAN PODATKOWY. WYPEĹNIÄ† NA MASZYNIE, KOMPUTEROWO LUB RÄCZNIE, DUĹ»YMI, DRUKOWANYMI LITERAMI, CZARNYM LUB NIEBIESKIM KOLOREM. PRZED WYPEĹNIENIEM NALEĹ»Y ZAPOZNAÄ† SIÄ Z OBJAĹšNIENIAMI.</span>
    </div>

    <!-- WIERSZ NIP / Nr dok / Status -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
      <tr>
        <td style="border:0.5px solid #000;padding:2px 4px;font-size:6pt;width:55%">1. Identyfikator podatkowy NIP / numer PESEL <sup>(niepotrzebne skreĹ›liÄ‡)</sup> <b>podatnika</b></td>
        <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:25%">2. Nr dokumentu</td>
        <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:20%">3. Status</td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 6px;font-size:10pt;font-weight:bold;letter-spacing:2px">${tp('tp-nip')}</td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
      </tr>
    </table>

    <!-- TYTUĹ -->
    <div style="display:flex;align-items:stretch;border:0.5px solid #000;margin-bottom:2px">
      <div style="padding:4px 8px;border-right:0.5px solid #000;font-size:16pt;font-weight:bold;font-family:Arial,sans-serif;display:flex;align-items:center;min-width:60px">DT-1</div>
      <div style="padding:4px 8px;flex:1">
        <div style="font-size:9pt;font-weight:bold;font-family:Arial,sans-serif">DEKLARACJA NA PODATEK OD ĹšRODKĂ“W TRANSPORTOWYCH</div>
        <div style="font-size:7.5pt;margin-top:2px">na <span style="border:0.5px solid #000;padding:1px 4px;font-weight:bold">&nbsp;4.&nbsp;Rok:&nbsp;${yr}&nbsp;</span></div>
        <div style="font-size:6pt;margin-top:3px;color:#444">Podstawa prawna: Art. 9 ust. 6 pkt 1 i 2 ustawy z dnia 12 stycznia 1991 r. o podatkach i opĹ‚atach lokalnych (Dz. U. z 2025 r. poz. 707). Stawki: UchwaĹ‚a XXIX/1065/2025 Rady m.st. Warszawy z 20.11.2025 r.</div>
      </div>
      <div style="padding:4px 8px;border-left:0.5px solid #000;font-size:7pt;text-align:right;white-space:nowrap">DT-1<sub>(5)</sub>&nbsp;&nbsp;1/4</div>
    </div>

    <!-- A. MIEJSCE SKĹADANIA -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">A. MIEJSCE SKĹADANIA DEKLARACJI</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;margin-bottom:2px">
      <span style="font-size:6pt;font-weight:bold">5. Nazwa i adres siedziby organu podatkowego</span><br>
      <span style="font-size:8pt;font-weight:bold">${tp('tp-organ')||'PREZYDENT M.ST. WARSZAWY, CENTRUM OBSĹUGI PODATNIKA, UL. OBOZOWA 57, 01-161 WARSZAWA, POLSKA'}</span>
    </div>

    <!-- B. DANE PODATNIKA -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">B. DANE PODATNIKA</div>
    <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:6.5pt;font-style:italic;margin-bottom:0">* - dotyczy podatnika niebÄ™dÄ…cego osobÄ… fizycznÄ… &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ** - dotyczy podatnika bÄ™dÄ…cego osobÄ… fizycznÄ…</div>

    <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;background:#d8d8d8;margin-bottom:0">B.1. DANE IDENTYFIKACYJNE</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:7.5pt;margin-bottom:0">
      <span style="font-size:6pt;font-weight:bold">6. Rodzaj podatnika</span> (zaznaczyÄ‡ wĹ‚aĹ›ciwy kwadrat):<br>
      <span style="margin-left:10px">${box(true)}&nbsp;1. podatnik niebÄ™dÄ…cy osobÄ… fizycznÄ… &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${box(false)}&nbsp;2. osoba fizyczna</span>
    </div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;margin-bottom:0">
      <div style="font-size:6pt;font-weight:bold">7. Nazwa peĹ‚na * / Nazwisko, pierwsze imiÄ™, data urodzenia **</div>
      <div style="font-size:9pt;font-weight:bold;margin-top:2px">${tp('tp-nazwa')}</div>
    </div>

    <!-- Adres -->
    <div style="border:0.5px solid #000;border-top:none;font-size:7pt;margin-bottom:2px">
      <div style="font-weight:bold;padding:1px 4px;background:#e8e8e8;font-family:Arial,sans-serif">B.2. ADRES SIEDZIBY * / ADRES ZAMIESZKANIA **</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="border-right:0.5px solid #000;border-bottom:0.5px solid #000;padding:2px 4px;width:15%"><div style="font-size:6pt">8. Kraj</div><div style="font-weight:bold">Polska</div></td>
          <td style="border-right:0.5px solid #000;border-bottom:0.5px solid #000;padding:2px 4px;width:25%"><div style="font-size:6pt">9. WojewĂłdztwo</div><div style="font-weight:bold">${tp('tp-woj')||'MAZOWIECKIE'}</div></td>
          <td style="border-right:0.5px solid #000;border-bottom:0.5px solid #000;padding:2px 4px;width:25%"><div style="font-size:6pt">10. Powiat</div><div style="font-weight:bold">WARSZAWA</div></td>
          <td style="border-bottom:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">11. Gmina</div><div style="font-weight:bold">BIAĹOĹÄKA</div></td>
        </tr>
        <tr>
          <td colspan="2" style="border-right:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">12. Ulica</div><div style="font-weight:bold">${tp('tp-ulica')}</div></td>
          <td style="border-right:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">13. Nr domu</div><div style="font-weight:bold">${tp('tp-dom')}</div></td>
          <td style="padding:2px 4px"><div style="font-size:6pt">14. Nr lokalu</div><div style="font-weight:bold">${tp('tp-lokal')||'â€”'}</div></td>
        </tr>
        <tr>
          <td colspan="2" style="border-right:0.5px solid #000;border-top:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">15. MiejscowoĹ›Ä‡</div><div style="font-weight:bold">${tp('tp-miasto')}</div></td>
          <td style="border-right:0.5px solid #000;border-top:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">16. Kod pocztowy</div><div style="font-weight:bold">${tp('tp-kod')}</div></td>
          <td style="border-top:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">17. Poczta</div><div style="font-weight:bold">${tp('tp-miasto')}</div></td>
        </tr>
      </table>
    </div>

    <!-- C. OBOWIÄ„ZEK -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">C. OBOWIÄ„ZEK SKĹADANIA DEKLARACJI</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:7.5pt;margin-bottom:2px">
      <div style="font-size:6pt;font-weight:bold">18. Przyczyny zĹ‚oĹĽenia deklaracji</div>
      <div style="margin-top:2px">
        ${box(celNr==='1')}&nbsp;1. deklaracja skĹ‚adana w terminie do dnia 15 lutego roku podatkowego &nbsp;&nbsp;
        ${box(celNr==='2')}&nbsp;2. powstanie obowiÄ…zku podatkowego w trakcie roku podatkowego<br>
        ${box(celNr==='3')}&nbsp;3. wygaĹ›niÄ™cie obowiÄ…zku podatkowego &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ${box(celNr==='4')}&nbsp;4. zmiana miejsca zamieszkania lub siedziby<br>
        ${box(celNr==='5')}&nbsp;5. korekta deklaracji &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ${box(celNr==='6')}&nbsp;6. przedĹ‚uĹĽenie okresu czasowego wycofania pojazdu z ruchu
      </div>
    </div>

    <!-- D. DANE DOTYCZÄ„CE -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">D. DANE DOTYCZÄ„CE PRZEDMIOTĂ“W OPODATKOWANIA (z wyjÄ…tkiem Ĺ›rodkĂłw transportowych zwolnionych z podatku)</div>
    <div style="border:0.5px solid #000;border-top:none;font-size:6.5pt;padding:2px 5px;margin-bottom:0;font-style:italic">W przypadku zaznaczenia w poz.18 kwadratu nr 2, 3, 5 lub 6 podatnik wypeĹ‚nia deklaracjÄ™ i zaĹ‚Ä…cznik tylko w zakresie pojazdĂłw, co do ktĂłrych obowiÄ…zek podatkowy powstaĹ‚, wygasĹ‚ lub zĹ‚oĹĽona wczeĹ›niej deklaracja zostaĹ‚a wypeĹ‚niona nieprawidĹ‚owo.</div>

    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <thead>
        <tr style="background:#e8e8e8">
          <th style="border:0.5px solid #000;padding:2px 4px;text-align:left;width:38%">Rodzaje Ĺ›rodkĂłw transportowych</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:center;width:15%">Liczba pojazdĂłw niepozostajÄ…cych we wspĂłĹ‚wĹ‚asnoĹ›ci</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:center;width:15%">Liczba pojazdĂłw pozostajÄ…cych we wspĂłĹ‚wĹ‚asnoĹ›ci Âą)</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:center;width:15%">Liczba pojazdĂłw pozostajÄ…cych we wspĂłĹ‚wĹ‚asnoĹ›ci Â˛)</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:right;width:17%">Kwota podatku zĹ‚, gr</th>
        </tr>
        <tr style="background:#e8e8e8">
          <th style="border:0.5px solid #000;border-top:none;padding:1px 4px;text-align:center">a</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">b</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">c</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">d</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">e</th>
        </tr>
      </thead>
      <tbody>
        ${catDefs.map(([cat,lbl,fn])=>{
          const d=cats[cat]||{count:0,amount:0};const filled=d.count>0;
          return `<tr style="${filled?'background:#f5fff5':''}">
            <td style="border:0.5px solid #000;border-top:none;padding:3px 4px"><b>${catDisplay(cat)}</b>&nbsp;${lbl}</td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
              <span style="font-size:5.5pt;color:#666">${fn[0]}.</span>&nbsp;<b>${filled?d.count:''}</b></td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
              <span style="font-size:5.5pt;color:#666">${fn[1]}.</span></td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
              <span style="font-size:5.5pt;color:#666">${fn[2]}.</span></td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:right;color:${filled?'#006600':'inherit'}">
              <span style="font-size:5.5pt;color:#666">${fn[3]}.</span>&nbsp;<b>${filled?d.amount.toFixed(2):''}</b></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <!-- Podsekcje D.8-D.15 -->
    ${[
      {title:'Samochody ciÄ™ĹĽarowe o dopuszczalnej masie caĹ‚kowitej rĂłwnej lub wyĹĽszej niĹĽ 12 ton', cats:['D8','D9','D10'], labels:['Dwie osie','Trzy osie','Cztery osie i wiÄ™cej'], fns:[[48,49,50,51],[52,53,54,55],[56,57,58,59]]},
      {title:'CiÄ…gniki siodĹ‚owe i balastowe przystosowane do uĹĽywania Ĺ‚Ä…cznie z naczepÄ… lub przyczepÄ… o dopuszczalnej masie caĹ‚kowitej zespoĹ‚u pojazdĂłw rĂłwnej lub wyĹĽszej niĹĽ 12 ton', cats:['D11','D12'], labels:['Dwie osie','Trzy osie i wiÄ™cej'], fns:[[60,61,62,63],[64,65,66,67]]},
      {title:'Przyczepy i naczepy, ktĂłre Ĺ‚Ä…cznie z pojazdem silnikowym posiadajÄ… dopuszczalnÄ… masÄ™ caĹ‚kowitÄ… rĂłwnÄ… lub wyĹĽszÄ… niĹĽ 12 ton, z wyjÄ…tkiem zwiÄ…zanych wyĹ‚Ä…cznie z dziaĹ‚alnoĹ›ciÄ… rolniczÄ… prowadzonÄ… przez podatnika podatku rolnego', cats:['D13','D14','D15'], labels:['Jedna oĹ›','Dwie osie','Trzy osie i wiÄ™cej'], fns:[[68,69,70,71],[72,73,74,75],[76,77,78,79]]},
    ].map(sec=>`
    <div style="border:0.5px solid #000;border-top:none;font-size:6.5pt;padding:2px 5px;text-align:center;font-weight:bold;background:#f0f0f0">${sec.title}</div>
    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <thead><tr style="background:#e8e8e8">
        <th style="border:0.5px solid #000;border-top:none;padding:2px 4px;width:20%">Liczba osi</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:center;width:20%">Liczba pojazdĂłw niepozostajÄ…cych we wspĂłĹ‚wĹ‚asnoĹ›ci</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:center;width:20%">Liczba pojazdĂłw pozostajÄ…cych we wspĂłĹ‚. Âą)</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:center;width:20%">Liczba pojazdĂłw pozostajÄ…cych we wspĂłĹ‚. Â˛)</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:right;width:20%">Kwota podatku zĹ‚, gr</th>
      </tr></thead>
      <tbody>${sec.cats.map((cat,i)=>{
        const d=cats[cat]||{count:0,amount:0};const filled=d.count>0;const fn=sec.fns[i];
        return `<tr style="${filled?'background:#f5fff5':''}">
          <td style="border:0.5px solid #000;border-top:none;padding:3px 4px"><b>${catDisplay(cat)}</b>&nbsp;${sec.labels[i]}</td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
            <span style="font-size:5.5pt;color:#666">${fn[0]}.</span>&nbsp;<b>${filled?d.count:''}</b></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
            <span style="font-size:5.5pt;color:#666">${fn[1]}.</span></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
            <span style="font-size:5.5pt;color:#666">${fn[2]}.</span></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:right;color:${filled?'#006600':'inherit'}">
            <span style="font-size:5.5pt;color:#666">${fn[3]}.</span>&nbsp;<b>${filled?d.amount.toFixed(2):''}</b></td>
        </tr>`;}).join('')}
      </tbody>
    </table>`).join('')}

    <!-- E. KWOTA PODATKU -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-top:1px">E. KWOTA PODATKU</div>
    <table style="width:100%;border-collapse:collapse;font-size:7.5pt">
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px;width:75%">
          <b>80.</b> Razem kwota podatku (suma kwot z kol. e w czÄ™Ĺ›ci D)<br>
          <span style="font-size:6pt">Suma kwot z kol. e w czÄ™Ĺ›ci D.</span>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;text-align:right;font-weight:bold;font-size:10pt;color:#006600">${total.toFixed(2)}&nbsp;zĹ‚</td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px">
          <b>81.</b> Kwota I raty podatku do zapĹ‚aty â€” zaokrÄ…glona do peĹ‚nych zĹ‚otych<br>
          <span style="font-size:6pt">(termin: 15 lutego)</span>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;text-align:right;font-weight:bold;color:#185FA5">${r1}&nbsp;zĹ‚</td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px">
          <b>82.</b> Kwota II raty podatku do zapĹ‚aty â€” zaokrÄ…glona do peĹ‚nych zĹ‚otych<br>
          <span style="font-size:6pt">(termin: 15 wrzeĹ›nia)</span>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;text-align:right;font-weight:bold;color:#185FA5">${r2}&nbsp;zĹ‚</td>
      </tr>
    </table>

    <!-- F. ZAĹÄ„CZNIKI -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-top:1px">F. INFORMACJA O ZAĹÄ„CZNIKACH</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:7.5pt;margin-bottom:1px">
      <b>83.</b> Liczba skĹ‚adanych zaĹ‚Ä…cznikĂłw DT-1/A: <span style="border:0.5px solid #000;padding:1px 6px;font-weight:bold;font-size:11pt">&nbsp;${groups.length}&nbsp;</span>
    </div>

    <!-- G. PODPIS -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px">G. PODPIS PODATNIKA / OSOBY REPREZENTUJÄ„CEJ PODATNIKA</div>
    <table style="width:100%;border-collapse:collapse;font-size:7pt">
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px;width:33%">
          <div style="font-size:6pt"><b>84. ImiÄ™</b></div>
          <div style="font-weight:bold;margin-top:4px">${tp('tp-imie')}</div>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;width:34%">
          <div style="font-size:6pt"><b>85. Nazwisko</b></div>
          <div style="font-weight:bold;margin-top:4px">${tp('tp-nazwisko')}</div>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;width:33%">
          <div style="font-size:6pt"><b>86. Data wypeĹ‚nienia</b> (dzieĹ„ - miesiÄ…c - rok)</div>
          <div style="margin-top:4px">${today}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:0.5px solid #000;border-top:none;padding:8px 5px">
          <span style="font-size:6pt"><b>87. Podpis (pieczÄ…tka) podatnika / osoby reprezentujÄ…cej podatnika</b></span>
          <div style="height:20px;border-bottom:0.5px solid #000;margin:4px 20px 0"></div>
        </td>
      </tr>
    </table>

    <!-- H. ADNOTACJE -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-top:1px">H. ADNOTACJE ORGANU PODATKOWEGO</div>
    <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:6.5pt"><b>88. Uwagi organu podatkowego</b><div style="height:20px"></div></div>
    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px;width:50%"><b>89. Identyfikator przyjmujÄ…cego formularz</b><div style="height:12px"></div></td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;width:50%"><b>90. Podpis przyjmujÄ…cego formularz</b><div style="height:12px"></div></td>
      </tr>
    </table>

    <!-- POUCZENIA -->
    <div style="font-size:6pt;margin-top:3px;padding:2px 5px;border:0.5px solid #ccc">
      <b>Pouczenia:</b> W przypadku niewpĹ‚acenia w obowiÄ…zujÄ…cym terminie kwoty podatku (raty podatku) od Ĺ›rodkĂłw transportowych z poz.81 i 82 lub wpĹ‚acenia jej w niepeĹ‚nej wysokoĹ›ci, niniejsza deklaracja stanowi podstawÄ™ do wystawienia tytuĹ‚u wykonawczego. Za podanie nieprawdy lub zatajenie prawdy i przez to naraĹĽenie podatku na uszczuplenie grozi odpowiedzialnoĹ›Ä‡ przewidziana w Kodeksie karnym skarbowym.
    </div>
  </div>`;

  // ====================================================================
  // DT-1/A(5) â€” ZAĹÄ„CZNIKI (po 3 pojazdy)
  // ====================================================================
  const zawieszMap = z => ({
    'pneumatyczne': [true,false,false],
    'rĂłwnowaĹĽne':   [false,true,false],
    'inne':         [false,false,true],
  }[z||'pneumatyczne']||[true,false,false]);

  const euroMap = e => {
    const s=(e||'').toUpperCase();
    if(s.includes('6'))return[false,false,false,false,false,false,true];
    if(s.includes('5'))return[false,false,false,false,false,true,false];
    if(s.includes('4'))return[false,false,false,false,true,false,false];
    if(s.includes('3'))return[false,false,false,true,false,false,false];
    if(s.includes('2'))return[false,false,true,false,false,false,false];
    if(s.includes('1'))return[false,true,false,false,false,false,false];
    return[true,false,false,false,false,false,false]; // Euro 0
  };

  const vehBlock = (v, blockNum) => {
    if(!v) return `
      <div style="border:0.5px solid #000;border-top:none;background:#f8f8f8;padding:2px 5px;font-size:6pt;font-weight:bold;font-family:Arial,sans-serif">
        B.${blockNum}. DANE SZCZEGĂ“ĹOWE DOTYCZÄ„CE ĹšRODKA TRANSPORTOWEGO ${blockNum} â€” pole niewypeĹ‚nione
      </div>
      <div style="border:0.5px solid #000;border-top:none;padding:10px 5px;font-size:6pt;color:#aaa;text-align:center">â€” â€”</div>`;

    const zaw = zawieszMap(v.zawieszenie);
    const eur = euroMap(v.euro);
    const isCiagnik = (v.typ||'').toLowerCase().includes('ciÄ…g')||(v.typ||'').toLowerCase().includes('ciag');
    const dmc = v.dmc?((v.dmc/1000).toFixed(3)):'';
    const dmcZ = v.dmcZespolu>0?((v.dmcZespolu/1000).toFixed(3)):'';
    const tax = calcTax(v);

    return `
    <div style="border:0.5px solid #000;border-top:none;background:#d8d8d8;padding:2px 5px;font-size:6.5pt;font-weight:bold;font-family:Arial,sans-serif">
      B.${blockNum}. DANE SZCZEGĂ“ĹOWE DOTYCZÄ„CE ĹšRODKA TRANSPORTOWEGO ${blockNum}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <b>1. Dane dotyczÄ…ce wĹ‚asnoĹ›ci albo wspĂłĹ‚wĹ‚asnoĹ›ci:</b>
          ${box(true)}&nbsp;1. wĹ‚aĹ›ciciel &nbsp; ${box(false)}&nbsp;2. wspĂłĹ‚. I &nbsp; ${box(false)}&nbsp;3. wspĂłĹ‚. II
        </td>
      </tr>
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <b>2. Rodzaj Ĺ›rodka transportowego:</b>
          ${box(!(v.typ||'').toLowerCase().includes('nacz')&&!(v.typ||'').toLowerCase().includes('przy')&&!(v.typ||'').toLowerCase().includes('auto')&&!isCiagnik)}&nbsp;1. samochĂłd ciÄ™ĹĽarowy &nbsp;
          ${box(isCiagnik)}&nbsp;2. ciÄ…gnik siodĹ‚owy &nbsp; ${box(false)}&nbsp;3. ciÄ…gnik balastowy &nbsp;
          ${box((v.typ||'').toLowerCase().includes('przy'))}&nbsp;4. przyczepa &nbsp;
          ${box((v.typ||'').toLowerCase().includes('nacz'))}&nbsp;5. naczepa &nbsp;
          ${box((v.typ||'').toLowerCase().includes('auto'))}&nbsp;6. autobus
        </td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:2px 4px;width:25%">
          <div style="font-size:5.5pt;font-weight:bold">3. Data pierwszej rejestracji na terytorium RP</div>
          <div style="margin-top:2px">${v.dataRejestracji||'â€”'}</div>
        </td>
        <td colspan="5" style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">4. Numer rejestracyjny pojazdu</div>
          <div style="font-weight:bold;font-size:10pt;letter-spacing:1px">${v.nrRej}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">5. Numer Identyfikacyjny VIN / nadwozia / podwozia / ramy <sup>1)</sup></div>
          <div style="font-weight:bold;font-size:8pt;letter-spacing:1px">${v.vin||'â€”'}</div>
        </td>
        <td colspan="3" style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">6. Marka, typ, model pojazdu</div>
          <div style="font-weight:bold">${v.marka} ${v.model}</div>
        </td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:2px 4px;width:14%">
          <div style="font-size:5.5pt;font-weight:bold">7. Rok produkcji</div>
          <div style="font-weight:bold">${v.rok||'â€”'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:22%">
          <div style="font-size:5.5pt;font-weight:bold">8. Data nabycia</div>
          <div>${v.dataNabycia||'â€”'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:22%">
          <div style="font-size:5.5pt;font-weight:bold">9. Data zbycia</div>
          <div>${v.dataZbycia||'â€”'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:21%">
          <div style="font-size:5.5pt;font-weight:bold">10. Data cz. wycofania z ruchu</div>
          <div>â€”</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:21%">
          <div style="font-size:5.5pt;font-weight:bold">12. Data wyrejestrowania</div>
          <div>â€”</div>
        </td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">13. DMC pojazdu (t)</div>
          <div style="font-weight:bold">${dmc}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">14. Masa wĹ‚asna ciÄ…gnika (t)</div>
          <div>${isCiagnik?dmc:'â€”'}</div>
        </td>
        <td colspan="3" style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">15. DMC zespoĹ‚u pojazdĂłw (t)</div>
          <div style="font-weight:bold">${dmcZ||'â€”'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">16. Liczba osi</div>
          <div style="font-weight:bold;font-size:10pt">${v.osie||2}</div>
        </td>
      </tr>
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">17. Rodzaj zawieszenia:</div>
          ${box(zaw[0])}&nbsp;1. pneumatyczne &nbsp;&nbsp;
          ${box(zaw[1])}&nbsp;2. rĂłwnowaĹĽne z pneumatycznym &nbsp;&nbsp;
          ${box(zaw[2])}&nbsp;3. inny system zawieszenia
        </td>
      </tr>
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">20. WpĹ‚yw pojazdu silnikowego na Ĺ›rodowisko naturalne (emisja spalin):</div>
          ${box(!eur.slice(1).some(Boolean))}&nbsp;Euro 0 &nbsp;
          ${box(eur[1])}&nbsp;Euro I/I &nbsp;
          ${box(eur[2])}&nbsp;Euro II/II &nbsp;
          ${box(eur[3])}&nbsp;Euro III/III &nbsp;
          ${box(eur[4])}&nbsp;Euro IV/IV &nbsp;
          ${box(eur[5])}&nbsp;Euro V/V &nbsp;
          ${box(eur[6])}&nbsp;<b>Euro VI/VI</b>
        </td>
      </tr>
      <tr style="background:#f0fff0">
        <td colspan="4" style="border:0.5px solid #000;border-top:none;padding:3px 4px">
          <div style="font-size:5.5pt;font-weight:bold">21. Kwota podatku</div>
          <div style="font-weight:bold;font-size:11pt;color:#006600">${(tax.amount||0).toFixed(2)}&nbsp;zĹ‚</div>
          <div style="font-size:5.5pt;color:#555">Kat. ${tax.cat||'â€”'} | Stawka: ${(tax.rate||0).toLocaleString('pl-PL')} zĹ‚ | ${v.miesiacePodatku||12} mies.${(parseInt(v.rok)||0)>=2024?' [Â§2]':''}</div>
        </td>
        <td colspan="2" style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px">
          <div style="font-size:5.5pt;font-weight:bold">22. Kwota podatku zapĹ‚aconego</div>
          <div style="height:16px"></div>
        </td>
      </tr>
    </table>`;
  };

  const dt1aForms = groups.map((grp, gi) => {
    const attNo = gi+1, attTot = groups.length;
    const nip = tp('tp-nip');
    const nazwa = tp('tp-nazwa');
    return `
    <div class="form-page" style="font-family:'Courier New',Courier,monospace;font-size:7.5pt;background:#fff;color:#000;padding:8mm 10mm;max-width:190mm;margin:0 auto 20px;border:1px solid #888;page-break-before:always">

      <!-- NAGĹĂ“WEK DT-1/A -->
      <div style="font-size:6pt;border:0.5px solid #000;padding:2px 4px;margin-bottom:2px">
        POLA JASNE WYPEĹNIA PODATNIK, POLA CIEMNE WYPEĹNIA ORGAN PODATKOWY. WYPEĹNIÄ† NA MASZYNIE, KOMPUTEROWO LUB RÄCZNIE, DUĹ»YMI, DRUKOWANYMI LITERAMI, CZARNYM LUB NIEBIESKIM KOLOREM. PRZED WYPEĹNIENIEM NALEĹ»Y ZAPOZNAÄ† SIÄ Z OBJAĹšNIENIAMI.
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
        <tr>
          <td style="border:0.5px solid #000;padding:2px 4px;font-size:6pt;width:55%">1. Identyfikator podatkowy NIP / numer PESEL <sup>(niepotrzebne skreĹ›liÄ‡)</sup> <b>podatnika</b></td>
          <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:25%">2. Nr dokumentu</td>
          <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:20%">3. Status</td>
        </tr>
        <tr>
          <td style="border:0.5px solid #000;border-top:none;padding:3px 6px;font-size:10pt;font-weight:bold;letter-spacing:2px">${nip}</td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
        </tr>
      </table>

      <!-- TYTUĹ DT-1/A -->
      <div style="display:flex;align-items:stretch;border:0.5px solid #000;margin-bottom:2px">
        <div style="padding:4px 8px;border-right:0.5px solid #000;font-size:14pt;font-weight:bold;font-family:Arial,sans-serif;display:flex;align-items:center;min-width:70px">DT-1/A</div>
        <div style="padding:4px 8px;flex:1">
          <div style="font-size:9pt;font-weight:bold;font-family:Arial,sans-serif">ZAĹÄ„CZNIK DO DEKLARACJI DT-1</div>
          <div style="font-size:6pt;margin-top:2px">Formularz DT-1/A moĹĽe byÄ‡ skĹ‚adany jedynie jako zaĹ‚Ä…cznik do deklaracji DT-1.</div>
        </div>
        <div style="padding:4px 8px;border-left:0.5px solid #000;text-align:center;min-width:80px">
          <div style="font-size:6pt;font-weight:bold">4. Numer zaĹ‚Ä…cznika</div>
          <div style="font-weight:bold;font-size:16pt;color:#185FA5">${attNo}&nbsp;/&nbsp;${attTot}</div>
        </div>
        <div style="padding:4px 6px;border-left:0.5px solid #000;font-size:7pt;text-align:right;white-space:nowrap">DT-1/A<sub>(5)</sub>&nbsp;1/2</div>
      </div>

      <!-- A. DANE PODATNIKA -->
      <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">A. DANE PODATNIKA</div>
      <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:6.5pt;font-style:italic">* - dotyczy podatnika niebÄ™dÄ…cego osobÄ… fizycznÄ… &nbsp;&nbsp;&nbsp; ** - dotyczy podatnika bÄ™dÄ…cego osobÄ… fizycznÄ…</div>
      <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:7.5pt">
        <span style="font-size:6pt;font-weight:bold">5. Rodzaj podatnika:</span>
        ${box(true)}&nbsp;1. podatnik niebÄ™dÄ…cy osobÄ… fizycznÄ… &nbsp;&nbsp;&nbsp;&nbsp; ${box(false)}&nbsp;2. osoba fizyczna
      </div>
      <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:8pt;font-weight:bold;margin-bottom:2px">${nazwa}</div>

      <!-- B. DANE ĹšRODKĂ“W TRANSPORTOWYCH -->
      <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">B. DANE DOTYCZÄ„CE ĹšRODKĂ“W TRANSPORTOWYCH</div>
      <div style="border:0.5px solid #000;border-top:none;background:#e0e0e0;font-size:7pt;font-weight:bold;font-family:Arial,sans-serif;padding:2px 5px;margin-bottom:0">B.1. DANE SZCZEGĂ“ĹOWE DOTYCZÄ„CE ĹšRODKA TRANSPORTOWEGO</div>

      ${vehBlock(grp[0]||null, 1)}
      ${vehBlock(grp[1]||null, 2)}
      ${vehBlock(grp[2]||null, 3)}

      <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:6pt;color:#555;margin-top:1px">
        NIP: ${nip} | ${nazwa} | Rok: ${yr} | ZaĹ‚Ä…cznik ${attNo}/${attTot} | Stawki: UchwaĹ‚a XXIX/1065/2025 m.st. Warszawa
      </div>
    </div>`;
  }).join('');

  const container = document.getElementById('forms-container');
  if(container) container.innerHTML = taxable.length===0
    ? '<div class="wbox"><i class="ti ti-alert-triangle"></i>Brak zaznaczonych pojazdĂłw z kategoriÄ… podatkowÄ…. PrzejdĹş do zakĹ‚adki <strong>Pojazdy</strong> i zaznacz pojazdy.</div>'
    : dt1 + dt1aForms;
  } catch(e) { console.error("renderFormularze:",e.message); }
}




// ==================== EKSPORT PD ====================
function updatePD() {
  const taxable = getSelTax().filter(v=>v.cat);
  const total = taxable.reduce((s,v)=>s+(v.amount||0),0);
  const pdEl = document.getElementById('pd-taxable'); if(pdEl) pdEl.textContent = taxable.length;
  const ptEl = document.getElementById('pd-total'); if(ptEl) ptEl.textContent = fmt2(total)+' zĹ‚';
  const cntEl = document.getElementById('pd-cnt'); if(cntEl) cntEl.textContent = taxable.length;
}

function pdZaw(z){const s=(z||'').toLowerCase();if(s.includes('rĂłwno')||s.includes('rowno'))return'ROWNOWAZNE Z PNEUMATYCZNYM';if(s.includes('inne')||s.includes('inny'))return'INNY';return'PNEUMATYCZNE';}
function pdEuroW(e){const s=(e||'').toLowerCase();if(s.includes('elektryczny'))return'POJAZD ELEKTRYCZNY';if(s.includes('hybr'))return'POJAZD HYBRYDOWY';if(s.includes('gaz'))return'POJAZD NAPEDZANY GAZEM ZIEMNYM';if(s.includes('wodor'))return'POJAZD NAPEDZANY WODOREM';return'EURO POJAZD SPALINOWY';}
function pdEuroL(e){const s=(e||'').toUpperCase();if(s.includes('6'))return'EURO 6/VI';if(s.includes('5'))return'EURO 5/V';if(s.includes('4'))return'EURO 4/IV';if(s.includes('3'))return'EURO 3/III';if(s.includes('2'))return'EURO 2/II';if(s.includes('1'))return'EURO 1/I';return'EURO 0';}
function pdTyp(typ){const t=(typ||'').toLowerCase();if(t.includes('ciÄ…gnik siodĹ‚owy'))return'CIAGNIK SIODLOWY';if(t.includes('ciÄ…gnik balastowy'))return'CIAGNIK BALASTOWY';if(t.includes('naczepa'))return'NACZEPA';if(t.includes('przyczepa'))return'PRZYCZEPA';if(t.includes('autobus'))return'AUTOBUS';return'SAMOCHOD CIEZAROWY';}

function exportPD() {
  const taxable = getSelTax().filter(v=>v.cat);
  if(!taxable.length){toast('âš  Brak pojazdĂłw z kategoriÄ… podatkowÄ…!');return;}
  const wb = XLSX.utils.book_new();
  const nip = tp('tp-nip');
  const nazwa = tp('tp-nazwa');
  const yr = document.getElementById('taxYear').value;
  const cel = tp('tp-cel');

  const ws1 = XLSX.utils.aoa_to_sheet([
    ['Rodzaj podatnika','Typ identyfikatora','Identyfikator','REGON','ImiÄ™','Nazwisko','Data urodzenia','Nazwa peĹ‚na','Nazwa skrĂłcona','Kraj zamieszkania','Kod pocztowy','WojewĂłdztwo','Powiat','Gmina','MiejscowoĹ›Ä‡','Ulica','Nr domu','Nr lokalu','Poczta'],
    ['SPOLKA KAPITALOWA','NIP',parseInt(nip)||nip,tp('tp-regon')||null,null,null,null,nazwa,null,'POLSKA',tp('tp-kod'),tp('tp-woj')||'MAZOWIECKIE','WARSZAWA','WARSZAWA',tp('tp-miasto').toUpperCase(),tp('tp-ulica').toUpperCase(),tp('tp-dom'),tp('tp-lokal')||null,tp('tp-miasto').toUpperCase()]
  ]);
  XLSX.utils.book_append_sheet(wb,ws1,'Dane Podatnika');

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Cel','Podmiot skĹ‚adajÄ…cy deklaracjÄ™','SposĂłb zĹ‚oĹĽenia','Cel zĹ‚oĹĽenia deklaracji korygowanej','Zmiana miejsca zamieszkania lub siedziby','Data zmiany miejsca zamieszkania lub siedziby'],
    [cel,'WLASCICIEL','PAPIEROWY','NOWA DEKLARACJA',null,null]
  ]);
  XLSX.utils.book_append_sheet(wb,ws2,'Informacje OgĂłlne');

  const hdrs=['Rodzaj Ĺ›rodka transportu','Nr rejestracyjny','VIN','Dopuszczalna masa caĹ‚kowita pojazdu','Masa wĹ‚asna ciÄ…gnika siodĹ‚owego','Dopuszczalna masa caĹ‚kowita zespoĹ‚u pojazdĂłw','Marka/model/typ','Rok produkcji','Liczba osi pojazdu','Rodzaj zawieszenia','Opis rodzaju zawieszenia','WpĹ‚yw na Ĺ›rodowisko naturalne','Poziom emisji spalin','Liczba miejsc do siedzenia','Wybierz zdarzenie opisujÄ…ce pojazd','Data pierwszej rejestracji na terytorium RP','Data Nabycia','Ĺšrodek transportowy byĹ‚ czasowo wycofany z ruchu od','Ĺšrodek transportowy byĹ‚ czasowo wycofany z ruchu do','Data sprzedaĹĽy/wyrejestrowania','Data zdarzenia powodujÄ…cego powstanie ostatniego obowiÄ…zku podatkowego','Kwota podatku zapĹ‚aconego'];
  const rows = taxable.map(v=>{
    const isCiagnik=(v.typ||'').toLowerCase().includes('ciagnik')||(v.typ||'').toLowerCase().includes('ciÄ…gnik');
    return [pdTyp(v.typ),v.nrRej.toUpperCase(),(v.vin||'').toUpperCase(),v.dmc/1000,isCiagnik?v.dmc/1000:null,v.dmcZespolu>0?v.dmcZespolu/1000:null,`${v.marka.toUpperCase()}/${v.model.toUpperCase()}`,String(v.rok),parseInt(v.osie)||2,pdZaw(v.zawieszenie),null,pdEuroW(v.euro),pdEuroL(v.euro),null,'BRAK ZDARZEN',null,null,null,null,null,null,Math.round(v.amount*100)/100];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  XLSX.utils.book_append_sheet(wb,ws3,'Ĺšrodek transportu');

  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Cel',null,'Rodzaj Ĺšrodka transportu',null,'Rodzaj zawieszenia',null,'WpĹ‚yw na Ĺ›rodowisko naturalne',null,'Poziom emisji spalin',null,'Wybierz zdarzenie opisujÄ…ce pojazd'],
    ['DEKLARACJA SKLADANA DO 15 LUTEGO',null,'SAMOCHOD CIEZAROWY',null,'PNEUMATYCZNE',null,'EURO POJAZD SPALINOWY',null,'EURO 0',null,'BRAK ZDARZEN'],
    ['WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU',null,'CIAGNIK SIODLOWY',null,'ROWNOWAZNE Z PNEUMATYCZNYM',null,'INSTALACJA GAZOWA',null,'EURO 1/I',null,'NABYCIE POJAZDU CZASOWO WYCOFANEGO'],
    ['KOREKTA DEKLARACJI',null,'CIAGNIK BALASTOWY',null,'INNY',null,'POJAZD ELEKTRYCZNY',null,'EURO 2/II',null,'NABYCIE/ZAREJESTROWANIE POJAZDU'],
    ['POWSTANIE OBOWIAZKU W TRAKCIE ROKU',null,'PRZYCZEPA',null,null,null,'POJAZD HYBRYDOWY',null,'EURO 3/III',null,'POJAZD ZOSTAL SPRZEDANY'],
    [null,null,'NACZEPA',null,null,null,'POJAZD NAPEDZANY GAZEM ZIEMNYM',null,'EURO 4/IV',null,'POJAZD ZOSTAL WYREJESTROWANY'],
    [null,null,'AUTOBUS',null,null,null,'POJAZD NAPEDZANY WODOREM',null,'EURO 5/V',null,'POJAZD ZOSTAL CZASOWO WYLACZONY Z RUCHU'],
    [null,null,null,null,null,null,null,null,'EURO 6/VI',null,'POJAZD ZOSTAL PRZYWROCONY DO RUCHU'],
  ]);
  XLSX.utils.book_append_sheet(wb,ws4,'SĹ‚owniki');

  XLSX.writeFile(wb,`DT1_PD_mToilet_${yr}.xlsx`);
  toast(`âś“ Plik DT1_PD_mToilet_${yr}.xlsx pobrany â€” ${taxable.length} pojazdĂłw`);
}





// ==================== WYPEĹNIANIE PDF MF â€” ostateczna wersja ====================
// fontkit jest wbudowany w stronÄ™ jako inline script (window.fontkit dostÄ™pny globalnie)

async function loadPdfLib() {
  if (window._pdfLibLoaded) return;
  // SprawdĹş czy biblioteki sÄ… juĹĽ zaĹ‚adowane (wbudowane inline)
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib nie jest dostÄ™pny â€” zaĹ‚aduj plik lokalnie');
  }
  if (typeof fontkit === 'undefined') {
    throw new Error('fontkit nie jest dostÄ™pny â€” zaĹ‚aduj plik lokalnie');
  }
  window._pdfLibLoaded = true;
}

function b64toU8(b64) {
  const s = b64.replace(/\s/g, '');
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function loadPolishFont() {
  // 1. ZaĹ‚adowana przez fetch() z Roboto.ttf (loadAssets)
  if (window._ROBOTO_BYTES) return window._ROBOTO_BYTES;
  // 2. Fallback CDN
  try {
    const resp = await fetch('https://fonts.gstatic.com/s/roboto/v47/KFOmCnqEu92Fr1Me5Q.ttf');
    if (!resp.ok) throw new Error('CDN HTTP ' + resp.status);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    window._ROBOTO_BYTES = bytes;
    return bytes;
  } catch(e) {
    console.warn('[PDF] Brak czcionki Roboto');
    return null;
  }
}

const WYB = {1:'/Wyb\u9ACD1',2:'/Wyb\u9ACD2',3:'/Wyb\u9ACD3',4:'/Wyb\u9ACD4',5:'/Wyb\u9ACD5',6:'/Wyb\u9ACD6'};
const CAT_NUMS = {D1:{b:20,e:23},D2:{b:24,e:27},D3:{b:28,e:31},D4:{b:32,e:35},D5:{b:36,e:39},D6:{b:40,e:43},D7:{b:44,e:47},D8:{b:48,e:51},D9:{b:52,e:55},D10:{b:56,e:59},D11:{b:60,e:63},D12:{b:64,e:67},D13:{b:68,e:71},D14:{b:72,e:75},D15:{b:76,e:79}};
const TYP={1:WYB[1],2:WYB[2],3:WYB[3],4:WYB[4],5:WYB[5],6:WYB[6]};
const ZAW={1:WYB[1],2:WYB[2],3:WYB[3]};

function tfp(form,name,val,fnt,sz){
  try{
    const f=form.getTextField(name);
    const txt=(val!==null&&val!==undefined)?String(val):'';
    f.setText(txt);
    if(fnt&&sz) f.setFontSize(sz);
    if(fnt) f.updateAppearances(fnt);
  }catch(e){}
}
function rgp(form,name,val){try{if(val)form.getRadioGroup(name).select(val);}catch(e){}}
function cbp(form,name,on){try{on?form.getCheckBox(name).check():form.getCheckBox(name).uncheck();}catch(e){}}
function euroSet(form,lvl,sfx){
  ['Check Box5-8','Check Box5-9','Check Box5-1','Check Box3','Check Box5-2','Check Box-6','Check Box7'].forEach((n,i)=>cbp(form,n+sfx,i===lvl));
}

async function pobierzWypelnionyPDF(){
  // Upewnij siÄ™ ĹĽe pliki PDF i biblioteki sÄ… zaĹ‚adowane
  if(!window._DT1_PDF_BYTES){
    toast('âŹł Ĺadowanie plikĂłw PDF...');
    try{ await loadAssets(); }
    catch(e){ toast('âťŚ Brak pliku DT1formularz.pdf â€” upewnij siÄ™ ĹĽe wszystkie pliki sÄ… w tym samym folderze co index.html'); return; }
  }
  const selT=typeof getSelTax==='function'?getSelTax():[];
  const taxable=selT.filter(v=>v.cat);
  if(!taxable.length){toast('âš  Zaznacz pojazdy â€” uĹĽyj "Zaznacz wszystkie opodatkowane"');return;}

  const btn=document.getElementById('btn-pobierz-pdf');
  const setBtn=t=>{if(btn){btn.disabled=!!t;btn.innerHTML=t||'<i class="ti ti-file-download"></i>Pobierz oryginalne PDF MF z danymi';}};
  setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> InicjalizujÄ™...');

  try{
    // SprawdĹş dostÄ™pnoĹ›Ä‡ bibliotek
    if(typeof PDFLib==='undefined')throw new Error('pdf-lib nie zaĹ‚adowany â€” otwĂłrz plik lokalnie (nie przez Claude)');
    if(typeof fontkit==='undefined')throw new Error('fontkit nie zaĹ‚adowany â€” otwĂłrz plik lokalnie (nie przez Claude)');

    const {PDFDocument}=PDFLib;
    setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> ĹadujÄ™ czcionkÄ™...');
    const fontBytes=await loadPolishFont();

    // Dane podatnika
    const tp=id=>(document.getElementById(id)||{}).value||'';
    const co=typeof getCurrentCompany==='function'?getCurrentCompany():{};
    const yr=(document.getElementById('taxYear')||{}).value||'2026';
    const nip=tp('tp-nip')||co.nip||'', nazwa=tp('tp-nazwa')||co.name||'';
    const organ=tp('tp-organ')||co.organ||'', woj=tp('tp-woj')||co.woj||'MAZOWIECKIE';
    const ulica=tp('tp-ulica')||co.ulica||'', dom=tp('tp-dom')||co.dom||'';
    const lokal=tp('tp-lokal')||co.lokal||'', miasto=tp('tp-miasto')||co.miasto||'';
    const kod=tp('tp-kod')||co.kod||'';
    const today=new Date().toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});

    const total=typeof totalTax==='function'?totalTax():taxable.reduce((s,v)=>s+(v.amount||0),0);
    const r1=Math.round(total/2),r2=Math.round(total)-r1;
    const cats={};
    taxable.forEach(v=>{if(!cats[v.cat])cats[v.cat]={cnt:0,amt:0};cats[v.cat].cnt++;cats[v.cat].amt+=v.amount||0;});
    const groups=[];
    for(let i=0;i<taxable.length;i+=3)groups.push(taxable.slice(i,i+3));

    console.log(`[PDF] ${taxable.length} pojazdĂłw â†’ ${groups.length} DT-1/A`);

    // ====== DT-1 ======
    setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> WypeĹ‚niam DT-1...');
    const dt1Doc=await PDFDocument.load(window._DT1_PDF_BYTES,{ignoreEncryption:true});
    dt1Doc.registerFontkit(fontkit); // MUSI byÄ‡ przed embedFont
    const fnt=fontBytes?await dt1Doc.embedFont(fontBytes):null;
    const f1=dt1Doc.getForm();
    const page1 = dt1Doc.getPage(0);

    tfp(f1,'PESEL',nip,fnt,10);
    tfp(f1,'5 Nazwa i adres siedziby organu podatkowego',organ,fnt,7);
    tfp(f1,'nazwa - nazwisko',nazwa,fnt,8);
    tfp(f1,'8 Kraj','Polska',fnt,8);
    tfp(f1,'9 WojewĂłdztwo',woj,fnt,8);
    tfp(f1,'10 Powiat','WARSZAWA',fnt,8);
    tfp(f1,'Gmina','BIAĹOĹÄKA',fnt,8);
    tfp(f1,'12 Ulica',ulica,fnt,8);
    tfp(f1,'13 Nr domu',dom,fnt,8);
    tfp(f1,'14 Nr lokalu',lokal||'â€”',fnt,8);
    tfp(f1,'MiejscowoĹ›Ä‡',miasto,fnt,8);
    tfp(f1,'16 Kod pocztowy',kod,fnt,8);
    tfp(f1,'Poczta',miasto,fnt,8);
    page1.drawText(yr, {
      x: 283,
      y: 638,
      size: 10,
      font: fnt || undefined
    });
    tfp(f1,'fill_15','',fnt,9); // pole 19 ma byÄ‡ puste
    tfp(f1,'fill_11',String(groups.length),fnt,10); // pole 83 liczba zaĹ‚Ä…cznikĂłw
    tfp(f1,'85 Nazwisko',tp('tp-nazwisko'),fnt,8);
    tfp(f1,'Data wypeĹ‚nienia',today,fnt,8);
    tfp(f1,'fill_12',tp('tp-imie'),fnt,8); // pole 84 ImiÄ™
    tfp(f1,'80',total.toFixed(2).replace('.',','),fnt,9);
    tfp(f1,'81',String(r1),fnt,9);
    tfp(f1,'82',String(r2),fnt,9);
    const rodzajPodatnika = tp('tp-rodzaj')==='fizyczny' ? 'WybĂłr2' : 'WybĂłr1';
    rgp(f1,'Group2',rodzajPodatnika);

    const celNr={
      'DEKLARACJA SKLADANA DO 15 LUTEGO':'WybĂłr1',
      'POWSTANIE OBOWIAZKU W TRAKCIE ROKU':'WybĂłr2',
      'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU':'WybĂłr3',
      'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY':'WybĂłr5',
      'KOREKTA DEKLARACJI':'WybĂłr6',
      'PRZEDLUZENIE WYCOFANIA':'WybĂłr7'
    }[tp('tp-cel')]||'WybĂłr1';

    rgp(f1,'Group3',celNr);
    Object.entries(CAT_NUMS).forEach(([cat,nums])=>{const d=cats[cat];tfp(f1,String(nums.b),d?String(d.cnt):'',fnt,9);tfp(f1,String(nums.e),d?d.amt.toFixed(2).replace('.',','):'',fnt,9);});
    f1.flatten();
    const dt1Bytes=await dt1Doc.save();
    const allBytes=[dt1Bytes];

    // ====== DT-1/A ======
    const dt1aTemplate=window._DT1A_PDF_BYTES;
    const SFXS=[['',1],['2',2],['3',3]];
    for(let gi=0;gi<groups.length;gi++){
      setBtn(`<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> ZaĹ‚Ä…cznik ${gi+1}/${groups.length}...`);
      try{
        const grp=groups[gi],attNo=gi+1;
        const doc=await PDFDocument.load(dt1aTemplate,{ignoreEncryption:true});
        doc.registerFontkit(fontkit);
        const fa=fontBytes?await doc.embedFont(fontBytes):null;
        const fm=doc.getForm();
        tfp(fm,'pesel',nip,fa,9);
        tfp(fm,'numer zaĹ‚Ä…cznika',String(attNo),fa,12);
        tfp(fm,'Text2',nazwa,fa,7);
        rgp(fm,'Group1',rodzajPodatnika);
        grp.forEach((v,i)=>{
          const[sfx,vnum]=SFXS[i];
          const dmc=v.dmc?(v.dmc/1000):0;
          const dmcI=Math.floor(dmc).toString();
          const dmcD=Math.round((dmc%1)*100).toString().padStart(2,'0');
          const dmcZ=v.dmcZespolu>0?(v.dmcZespolu/1000).toFixed(2).replace('.',','):'';
          const kwI=Math.floor(v.amount||0).toString();
          const kwD=Math.round(((v.amount||0)%1)*100).toString().padStart(2,'0');
          const vf=`5 Numer Identyfikacyjny VIN  nadwozia podwozia lub ramy ${vnum}1`;
          tfp(fm,`4 Numer rejestracyjny pojazdu${sfx}`,v.nrRej,fa,9);
          tfp(fm,vf,v.vin,fa,7);
          tfp(fm,`6 Marka typ model pojazdu${sfx}`,`${v.marka||''} ${v.model||''}`,fa,8);
          tfp(fm,`rok produkcji${sfx}`,String(v.rok||''),fa,8);
          const dI=sfx===''?'Text3':sfx==='2'?'Text32':'Text33';
          const dD=sfx===''?'Text4':sfx==='2'?'Text42':'Text43';
          const dZ=sfx===''?'Text3-111':sfx==='2'?'Text3-122':'Text3-3';
          const dZd=sfx===''?'Text4-111':sfx==='2'?'Text4-1222':'Text4-33';
          const oF=sfx===''?'Text4-1':sfx==='2'?'Text4-12':'Text4-13';
          const kI=sfx===''?'Text6':sfx==='2'?'Text62':'Text63';
          const kD=sfx===''?'Text7':sfx==='2'?'Text72':'Text73';
          tfp(fm,dI,dmcI,fa,9);tfp(fm,dD,dmcD,fa,9);
          if(dmcZ){const dZparts=dmcZ.split(',');tfp(fm,dZ,dZparts[0],fa,9);tfp(fm,dZd,dZparts[1]||'00',fa,9);}
          tfp(fm,oF,String(v.osie||2),fa,10);
          tfp(fm,kI,kwI,fa,9);tfp(fm,kD,kwD,fa,9);
          const DF={'':  {rej:'Data rejestracji',  nab:'Dzien nabycia',  zb:'data zbycia1',wyc:'data wycofania',  dop:'data dopuszczenia',  wyr:'data wyrejestrowania'},
                    '2': {rej:'Data rejestracji22',nab:'Dzien nabycia2', zb:'data zbycia2',wyc:'data wycofania2', dop:'data dopuszczenia2', wyr:'data wyrejestrowania2'},
                    '3': {rej:'Data rejestracji3', nab:'Dzien nabycia3', zb:'data zbycia3',wyc:'data wycofania3', dop:'data dopuszczenia3', wyr:'data wyrejestrowania3'}}[sfx];
          tfp(fm,DF.rej,v.dataRejestracji||'',fa,7);tfp(fm,DF.nab,v.dataNabycia||'',fa,7);
          tfp(fm,DF.zb,v.dataZbycia||'',fa,7);tfp(fm,DF.wyc,'',fa,7);tfp(fm,DF.dop,'',fa,7);tfp(fm,DF.wyr,'',fa,7);
          rgp(fm,sfx===''?'Group3':sfx==='2'?'Group22':'Group23',WYB[1]);
          rgp(fm,sfx===''?'Group2':sfx==='2'?'Group32':'Group33',TYP[v.typ_nr||1]||WYB[1]);
          const zawNr=v.zawieszenie==='rĂłwnowaĹĽne z pneumatycznym'?2:v.zawieszenie==='inny system zawieszenia'?3:1;
          rgp(fm,sfx===''?'Group4':sfx==='2'?'Group42':'Group43',ZAW[zawNr]||WYB[1]);
          const eL=v.euro_nr!=null?v.euro_nr:((v.euro||'').includes('6')?6:(v.euro||'').includes('5')?5:(v.euro||'').includes('4')?4:(v.euro||'').includes('3')?3:(v.euro||'').includes('2')?2:(v.euro||'').includes('1')?1:0);
          euroSet(fm,eL,sfx);
        });
        fm.flatten();
        allBytes.push(await doc.save());
        console.log(`[PDF] ZaĹ‚. ${attNo}/${groups.length} gotowy`);
      }catch(e2){
        console.error(`[PDF] ZaĹ‚. ${gi+1} bĹ‚Ä…d:`,e2.message);
        // Kontynuuj z pozostaĹ‚ymi zaĹ‚Ä…cznikami
      }
    }

    // ====== SCAL ======
    setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Scalanie PDF...');
    const finalDoc=await PDFDocument.create();
    for(const bytes of allBytes){
      try{
        const src=await PDFDocument.load(bytes);
        const pages=await finalDoc.copyPages(src,src.getPageIndices());
        pages.forEach(p=>finalDoc.addPage(p));
      }catch(e3){console.error('[PDF] Merge error:',e3);}
    }
    const finalBytes=await finalDoc.save();
    const blob=new Blob([finalBytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    // Pobierz
    const a=document.createElement('a');a.href=url;
    a.download=`DT-1_${nip.replace(/\D/g,'')}_${yr}.pdf`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    // PodglÄ…d PDF w iframe
    const previewEl=document.getElementById('forms-container');
    if(previewEl){
      if(window._lastPdfUrl) URL.revokeObjectURL(window._lastPdfUrl);
      window._lastPdfUrl=url;
      previewEl.innerHTML='<p style="text-align:center;font-size:12px;color:#666;margin:8px">PodglÄ…d wygenerowanego PDF â€” przewiĹ„ aby zobaczyÄ‡ wszystkie strony</p>'
        +'<iframe src="'+url+'#view=FitH" style="width:100%;height:1100px;border:1px solid #ddd;border-radius:4px"></iframe>';
    } else {
      URL.revokeObjectURL(url);
    }
    toast(`âś… Pobrano: DT-1 + ${allBytes.length-1} Ă— DT-1/A | ${taxable.length} pojazdĂłw | polskie znaki âś“`);

  }catch(err){
    console.error('[PDF]',err);
    toast('âťŚ ' + err.message);
  }finally{setBtn(null);}
}



function printFormularze() {
  renderFormularze();
  setTimeout(() => window.print(), 500);
}


// Synchronizuj rok i przyczynÄ™ miÄ™dzy zakĹ‚adkami
function syncTaxYear() {
  const main = document.getElementById('taxYear');
  const alt  = document.getElementById('taxYearPodatnik');
  if (main && alt) alt.value = main.value;
}
function syncTpCel() {
  const main = document.getElementById('tp-cel');
  const alt  = document.getElementById('tp-celPodatnik');
  if (main && alt) alt.value = main.value;
}

// ==================== TOAST ====================
function toast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="ti ti-check"></i> ${msg}`;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

// ==================== WALIDACJA ====================
function runValidation() {
  const selT = getSelTax();
  const errors = [], warnings = [], infos = [];
  const nip = tp('tp-nip');

  // --- BĹÄDY KRYTYCZNE ---
  // 1. NIP
  if(!/^\d{10}$/.test(nip.replace(/[-\s]/g,''))) {
    errors.push({code:'NIP-001',title:'NieprawidĹ‚owy NIP podatnika',desc:`NIP "${nip}" nie speĹ‚nia wymagaĹ„ (10 cyfr). Popraw w zakĹ‚adce Podatnik.`,link:'podatnik',icon:'ti-id'});
  }
  // 2. Brak pojazdĂłw
  if(selT.length===0) {
    errors.push({code:'DT1-001',title:'Brak zaznaczonych pojazdĂłw',desc:'Nie zaznaczono ĹĽadnych pojazdĂłw do deklaracji. PrzejdĹş do zakĹ‚adki Pojazdy.',link:'pojazdy',icon:'ti-truck'});
  }
  // 3. Pojazdy bez kategorii
  const brakKat = selT.filter(v=>!v.cat);
  brakKat.forEach(v=>{
    errors.push({code:'KAT-001',veh:v.nrRej,title:`${v.nrRej} â€” brak kategorii DT-1`,desc:`Pojazd ${v.marka} ${v.model} (DMC: ${(v.dmc/1000).toFixed(1)} t) nie ma przypisanej kategorii D.1â€“D.15. SprawdĹş typ pojazdu i DMC.`,link:'pojazdy',icon:'ti-alert-circle'});
  });
  // 4. Przyczepa/naczepa bez DMC zespoĹ‚u
  selT.forEach(v=>{
    const isTrailer=(v.typ||'').toLowerCase().includes('przy')||(v.typ||'').toLowerCase().includes('nacz');
    if(isTrailer && !v.dmcZespolu) {
      errors.push({code:'DMC-001',veh:v.nrRej,title:`${v.nrRej} â€” brak DMC zespoĹ‚u pojazdĂłw`,desc:`Przyczepa/naczepa ${v.marka} ${v.model} wymaga podania DMC zespoĹ‚u (przyczepa + pojazd ciÄ…gnÄ…cy) do prawidĹ‚owej kategoryzacji i wyliczenia podatku.`,link:'pojazdy',icon:'ti-scale'});
    }
  });
  // 5. Suma deklaracji = 0 przy zaznaczonych pojazdach
  const total = totalTax();
  if(selT.length>0 && total===0) {
    errors.push({code:'SUM-001',title:'ĹÄ…czny podatek wynosi 0 zĹ‚',desc:'Suma podatku z poz. 80 wynosi 0 zĹ‚ przy zaznaczonych pojazdach. SprawdĹş czy kategorie sÄ… poprawnie przypisane.',link:'kalkulator',icon:'ti-cash'});
  }
  // 6. NiezgodnoĹ›Ä‡ liczby zaĹ‚Ä…cznikĂłw
  const taxable = selT.filter(v=>v.cat);
  const attCalc = Math.ceil(taxable.length/3);
  if(taxable.length>0 && attCalc===0) {
    errors.push({code:'ATT-001',title:'BĹ‚Ä™dna liczba zaĹ‚Ä…cznikĂłw DT-1/A',desc:'Liczba zaĹ‚Ä…cznikĂłw DT-1/A wynosi 0 mimo istnienia pojazdĂłw z kategoriÄ…. OdĹ›wieĹĽ kalkulator.',link:'kalkulator',icon:'ti-paperclip'});
  }

  // --- OSTRZEĹ»ENIA ---
  // 7. Pojazdy â‰Ą12t bez prawidĹ‚owej liczby osi
  selT.forEach(v=>{
    if(v.dmc>=12000 && (!v.osie||v.osie<2)) {
      warnings.push({code:'OSI-001',veh:v.nrRej,title:`${v.nrRej} â€” sprawdĹş liczbÄ™ osi`,desc:`Pojazd o DMC â‰Ą12 t (${(v.dmc/1000).toFixed(1)} t) powinien mieÄ‡ co najmniej 2 osie. Aktualnie: ${v.osie}. Liczba osi wpĹ‚ywa na stawkÄ™ podatkowÄ….`,link:'pojazdy',icon:'ti-settings'});
    }
  });
  // 8. VIN pusty lub za krĂłtki
  selT.forEach(v=>{
    if(!v.vin || v.vin.trim().length<5) {
      warnings.push({code:'VIN-001',veh:v.nrRej,title:`${v.nrRej} â€” brakujÄ…cy lub nieprawidĹ‚owy VIN`,desc:`Pojazd ${v.marka} ${v.model} ma pusty lub za krĂłtki numer VIN (min. 17 znakĂłw dla nowych pojazdĂłw). VIN jest wymagany w formularzu DT-1/A.`,link:'pojazdy',icon:'ti-fingerprint'});
    }
  });
  // 9. Pojazd 2024+ bez Â§2
  selT.forEach(v=>{
    if((parseInt(v.rok)||0)>=2024 && v.cat && v.rate) {
      const expectedNew = {D1:744,D2:1008,D3:1344,D4:1248,D5:1128};
      const expectedOld = {D1:840,D2:1128,D3:1488,D4:1392,D5:1248};
      if(expectedOld[v.cat] && v.rate===expectedOld[v.cat]) {
        warnings.push({code:'PAR-002',veh:v.nrRej,title:`${v.nrRej} â€” moĹĽliwa obniĹĽona stawka Â§2`,desc:`Pojazd z roku ${v.rok} moĹĽe kwalifikowaÄ‡ siÄ™ do stawki Â§2 (obniĹĽonej dla pojazdĂłw rok â‰Ą 2024). Aktualna stawka: ${v.rate} zĹ‚. Stawka Â§2: ${expectedNew[v.cat]} zĹ‚. Zweryfikuj z uchwaĹ‚Ä….`,link:'stawki',icon:'ti-discount'});
      }
    }
  });
  // 10. Marka/model nieznana (tylko 2-3 litery nr rej)
  selT.forEach(v=>{
    if((v.nrRej||'').length<=3 && !v.rok) {
      warnings.push({code:'DAT-001',veh:v.nrRej,title:`${v.nrRej} â€” niekompletne dane pojazdu`,desc:`Pojazd ma niepeĹ‚ny numer rejestracyjny lub brakuje roku produkcji. SprawdĹş dane w dowodzie rejestracyjnym.`,link:'pojazdy',icon:'ti-file-description'});
    }
  });
  // 11. Podatek = 0 dla pojazdu z kategoriÄ…
  selT.forEach(v=>{
    if(v.cat && v.amount===0) {
      warnings.push({code:'TAX-001',veh:v.nrRej,title:`${v.nrRej} â€” podatek 0 zĹ‚ mimo kategorii ${v.cat}`,desc:`Pojazd ma przypisanÄ… kategoriÄ™ ${v.cat}, ale wyliczony podatek wynosi 0 zĹ‚. SprawdĹş liczbÄ™ miesiÄ™cy i stawkÄ™.`,link:'pojazdy',icon:'ti-coin'});
    }
  });
  // 12. Pojazd wynajÄ™ty w deklaracji
  selT.forEach(v=>{
    if(v.status==='WynajÄ™ty') {
      warnings.push({code:'WYN-001',veh:v.nrRej,title:`${v.nrRej} â€” pojazd WYNAJÄTY w deklaracji`,desc:`Pojazd ${v.marka} ${v.model} (wĹ‚aĹ›ciciel: ${v.wlasciciel}) ma status WynajÄ™ty. ObowiÄ…zek podatkowy ciÄ…ĹĽy na wĹ‚aĹ›cicielu/leasingodawcy â€” zweryfikuj czy mToilet jest podatnikiem dla tego pojazdu.`,link:'pojazdy',icon:'ti-contract'});
    }
  });

  // --- INFORMACJE ---
  // 13. Brak danych podatnika
  if(!tp('tp-imie')||!tp('tp-nazwisko')) {
    infos.push({code:'POD-001',title:'Brak danych osoby podpisujÄ…cej',desc:'Nie uzupeĹ‚niono imienia i/lub nazwiska osoby podpisujÄ…cej deklaracjÄ™ (poz. 84â€“85 DT-1). UzupeĹ‚nij w zakĹ‚adce Podatnik.',link:'podatnik',icon:'ti-user'});
  }
  // 14. DuĹĽe pojazdy ciÄ™ĹĽarowe â‰Ą12t
  const heavyNoAxle = selT.filter(v=>v.dmc>=12000&&v.osie>=4&&v.cat);
  if(heavyNoAxle.length>0) {
    infos.push({code:'OSI-002',title:`${heavyNoAxle.length} pojazd(Ăłw) â‰Ą12 t z 4+ osiami`,desc:`Pojazdy z 4 i wiÄ™cej osiami majÄ… najwyĹĽsze stawki w kategorii D.10. SprawdĹş czy liczba osi jest prawidĹ‚owa w dowodzie rejestracyjnym.`,link:'pojazdy',icon:'ti-info-circle'});
  }
  // 15. PodwĂłjna kategoryzacja
  const nrRejList = selT.map(v=>v.nrRej);
  const dupes = nrRejList.filter((v,i)=>nrRejList.indexOf(v)!==i);
  if(dupes.length>0) {
    infos.push({code:'DUP-001',title:`Zduplikowane pojazdy: ${dupes.join(', ')}`,desc:'Te same numery rejestracyjne pojawiajÄ… siÄ™ wiÄ™cej niĹĽ raz w bazie danych. SprawdĹş i usuĹ„ duplikaty.',link:'pojazdy',icon:'ti-copy'});
  }

  // Aktualizuj badge
  const totalIssues = errors.length+warnings.length;
  document.getElementById('badge-err').textContent = totalIssues;
  document.getElementById('badge-err').style.background = errors.length>0?'var(--red)':warnings.length>0?'var(--amber)':'var(--green)';

  // Aktualizuj liczniki
  document.getElementById('val-progress').classList.remove('hidden');
  document.getElementById('val-cnt-err').textContent = errors.length;
  document.getElementById('val-cnt-warn').textContent = warnings.length;
  document.getElementById('val-cnt-info').textContent = infos.length;
  const okCount = selT.filter(v=>!errors.find(e=>e.veh===v.nrRej)&&!warnings.find(w=>w.veh===v.nrRej)).length;
  document.getElementById('val-cnt-ok').textContent = okCount;

  const summary = document.getElementById('val-summary');
  if(errors.length===0&&warnings.length===0) {
    summary.innerHTML = '<span style="color:var(--green);font-weight:500"><i class="ti ti-circle-check"></i> Deklaracja gotowa do zĹ‚oĹĽenia â€” brak bĹ‚Ä™dĂłw!</span>';
  } else {
    summary.innerHTML = `<span style="color:var(--red)">${errors.length} bĹ‚Ä…d(Ăłw) krytycznych</span> Â· <span style="color:var(--amber)">${warnings.length} ostrzeĹĽeĹ„</span> Â· <span style="color:var(--blue)">${infos.length} informacji</span>`;
  }

  const renderIssue = (issue, type) => {
    const colors = {err:{bg:'var(--red-light)',border:'#F09595',text:'#791F1F',icon:'ti-alert-circle',label:'BĹÄ„D KRYTYCZNY'},warn:{bg:'var(--amber-light)',border:'#EF9F27',text:'#633806',icon:'ti-alert-triangle',label:'OSTRZEĹ»ENIE'},info:{bg:'var(--blue-light)',border:'#B5D4F4',text:'var(--blue-dark)',icon:'ti-info-circle',label:'INFORMACJA'}};
    const c = colors[type];
    return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
      <i class="ti ${issue.icon||c.icon}" style="font-size:20px;color:${c.text};flex-shrink:0;margin-top:1px"></i>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${c.text};color:#fff">${c.label}</span>
          <span style="font-size:10px;color:${c.text};font-family:var(--mono)">${issue.code}</span>
          ${issue.veh?`<span style="font-family:var(--mono);font-size:11px;font-weight:600;color:${c.text}">${issue.veh}</span>`:''}
        </div>
        <div style="font-weight:600;font-size:13px;color:${c.text};margin-bottom:3px">${issue.title}</div>
        <div style="font-size:12px;color:${c.text};opacity:.85;line-height:1.5">${issue.desc}</div>
      </div>
      ${issue.link?`<button class="btn btn-gray" style="flex-shrink:0;font-size:11px" onclick="showPage('${issue.link}')"><i class="ti ti-arrow-right"></i>PrzejdĹş</button>`:''}
    </div>`;
  };

  let html = '';
  if(errors.length===0&&warnings.length===0&&infos.length===0) {
    html = `<div class="gbox"><i class="ti ti-circle-check" style="font-size:24px"></i><div><strong>Deklaracja poprawna!</strong><br>Wszystkie sprawdzane reguĹ‚y speĹ‚nione. MoĹĽesz przejĹ›Ä‡ do zakĹ‚adki DT-1/A i wydrukowaÄ‡ formularze.</div></div>`;
  } else {
    if(errors.length>0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-circle"></i>BĹ‚Ä™dy krytyczne â€” wymagajÄ… poprawy przed zĹ‚oĹĽeniem deklaracji</div>`;
      html += errors.map(e=>renderIssue(e,'err')).join('');
    }
    if(warnings.length>0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--amber);margin:16px 0 10px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-triangle"></i>OstrzeĹĽenia â€” zalecana weryfikacja</div>`;
      html += warnings.map(w=>renderIssue(w,'warn')).join('');
    }
    if(infos.length>0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--blue);margin:16px 0 10px;display:flex;align-items:center;gap:6px"><i class="ti ti-info-circle"></i>Informacje</div>`;
      html += infos.map(i=>renderIssue(i,'info')).join('');
    }
  }
  document.getElementById('val-results').innerHTML = html;
  toast(`âś“ Walidacja zakoĹ„czona â€” ${errors.length} bĹ‚Ä™dĂłw, ${warnings.length} ostrzeĹĽeĹ„`);
}

// ==================== RAPORTY ====================
function getRpVehs() {
  const fWl = document.getElementById('rp-wl')?.value||'';
  const fStat = document.getElementById('rp-status')?.value||'';
  return vehs.filter(v=>(!fWl||v.wlasciciel===fWl)&&(!fStat||v.status===fStat));
}

function renderRaporty() {
  const list = getRpVehs();
  const grouped = document.getElementById('rp-group')?.value||'marka';
  const taxes = list.map(v=>({...v,...calcTax(v)}));
  const total = taxes.reduce((s,v)=>s+(v.amount||0),0);
  const taxable = taxes.filter(v=>v.cat);
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const newCount = taxes.filter(v=>(parseInt(v.rok)||0)>=2024&&v.cat).length;
  const newTax = taxes.filter(v=>(parseInt(v.rok)||0)>=2024&&v.cat).reduce((s,v)=>s+(v.amount||0),0);
  const oldTax = total - newTax;

  // KPI
  document.getElementById('rp-kpi').innerHTML = [
    ['Pojazdy w analizie',list.length,'','var(--text)'],
    ['Podatek roczny razem',fmt2(total)+' zĹ‚','poz. 80 DT-1','var(--green)'],
    ['I rata (15.02)',fmtZl(r1)+' zĹ‚','do zapĹ‚aty','var(--blue)'],
    ['II rata (15.09)',fmtZl(r2)+' zĹ‚','do zapĹ‚aty','var(--blue)'],
    ['Pojazdy Â§2 (2024+)',newCount+' poj.','obniĹĽona stawka','var(--amber)'],
  ].map(([l,v,s,c])=>`<div class="stat"><div class="stat-label">${l}</div><div class="stat-val" style="color:${c};font-size:22px">${v}</div><div class="stat-sub">${s}</div></div>`).join('');

  // Grupowanie
  const groups = {};
  const groupLabel = {marka:'marka',cat:'kategoriÄ™ DT-1',status:'status wĹ‚asnoĹ›ci',rok:'rok produkcji'};
  document.getElementById('rp-chart-title').textContent = `Podatek roczny wg ${groupLabel[grouped]||'marki'}`;

  taxes.filter(v=>v.cat).forEach(v=>{
    const key = grouped==='cat'?v.cat:grouped==='rok'?Math.floor((parseInt(v.rok)||0)/5)*5+'â€“'+(Math.floor((parseInt(v.rok)||0)/5)*5+4):v[grouped]||'Inne';
    if(!groups[key])groups[key]={count:0,tax:0,veh:[]};
    groups[key].count++;groups[key].tax+=v.amount;groups[key].veh.push(v.nrRej);
  });
  const maxTax = Math.max(...Object.values(groups).map(g=>g.tax),1);

  // Wykres sĹ‚upkowy
  const barColors = ['var(--blue)','var(--green)','var(--amber)','var(--red)','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  document.getElementById('rp-chart').innerHTML = Object.entries(groups).sort((a,b)=>b[1].tax-a[1].tax).map(([k,g],i)=>{
    const pct = Math.round(g.tax/maxTax*100);
    const col = barColors[i%barColors.length];
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:110px;font-size:12px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text2)">${k}</div>
      <div style="flex:1;background:var(--bg3);border-radius:4px;overflow:hidden;height:22px">
        <div style="width:${pct}%;background:${col};height:100%;border-radius:4px;display:flex;align-items:center;padding-left:8px;transition:width .4s">
          <span style="font-size:10px;color:#fff;white-space:nowrap;font-weight:600">${pct>15?fmt2(g.tax)+' zĹ‚':''}</span>
        </div>
      </div>
      <div style="width:85px;font-size:11px;font-family:var(--mono);text-align:right;color:${col};font-weight:600">${fmt2(g.tax)} zĹ‚</div>
      <div style="width:30px;font-size:11px;color:var(--text3);text-align:right">${g.count}</div>
    </div>`;
  }).join('') || '<div style="color:var(--text3);text-align:center;padding:1rem">Brak danych</div>';

  // Â§1 vs Â§2 pie
  const p1 = total>0?Math.round(oldTax/total*100):0;
  const p2 = 100-p1;
  const oldCount = taxable.length-newCount;
  document.getElementById('rp-pie').innerHTML = `
    <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap">
      <div style="position:relative;width:120px;height:120px;flex-shrink:0">
        <svg viewBox="0 0 36 36" style="width:120px;height:120px;transform:rotate(-90deg)">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg3)" stroke-width="3.2"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--blue)" stroke-width="3.2"
            stroke-dasharray="${p1} ${100-p1}" stroke-dashoffset="0"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--amber)" stroke-width="3.2"
            stroke-dasharray="${p2} ${100-p2}" stroke-dashoffset="${-p1}"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${p1}%</div>
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:14px;height:14px;border-radius:3px;background:var(--blue);flex-shrink:0"></div>
          <div>
            <div style="font-weight:600;font-size:13px">Â§1 â€” stawka standardowa</div>
            <div style="font-size:12px;color:var(--text2)">${oldCount} pojazdĂłw Â· ${fmt2(oldTax)} zĹ‚ (${p1}%)</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:14px;height:14px;border-radius:3px;background:var(--amber);flex-shrink:0"></div>
          <div>
            <div style="font-weight:600;font-size:13px">Â§2 â€” stawka obniĹĽona (rok â‰Ą 2024)</div>
            <div style="font-size:12px;color:var(--text2)">${newCount} pojazdĂłw Â· ${fmt2(newTax)} zĹ‚ (${p2}%)</div>
          </div>
        </div>
        <div style="padding:10px;background:var(--green-light);border-radius:var(--radius);border:1px solid #a3c97a">
          <div style="font-size:11px;color:var(--green);font-weight:600">OszczÄ™dnoĹ›Ä‡ dziÄ™ki Â§2</div>
          <div style="font-size:16px;font-weight:700;color:var(--green)">${fmt2(newCount*((840-744)+(1128-1008))/2)} zĹ‚ est.</div>
          <div style="font-size:10px;color:var(--green)">szacunkowe (Ĺ›r. rĂłĹĽnica stawek)</div>
        </div>
      </div>
    </div>`;

  // Harmonogram
  const months = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','PaĹş','Lis','Gru'];
  document.getElementById('rp-harmonogram').innerHTML = `<table>
    <thead><tr>
      ${months.map((m,i)=>`<th style="text-align:center;${i===1||i===8?'background:var(--blue-light);color:var(--blue)':''}">${m} 2026</th>`).join('')}
    </tr></thead>
    <tbody><tr>
      ${months.map((m,i)=>{
        if(i===1) return `<td style="text-align:center;font-weight:700;color:var(--blue);background:var(--blue-light)" title="Termin zĹ‚oĹĽenia DT-1 i wpĹ‚aty I raty">${fmtZl(r1)} zĹ‚<div style="font-size:9px">I rata + DT-1</div></td>`;
        if(i===8) return `<td style="text-align:center;font-weight:700;color:var(--blue);background:var(--blue-light)" title="Termin wpĹ‚aty II raty">${fmtZl(r2)} zĹ‚<div style="font-size:9px">II rata</div></td>`;
        return `<td style="text-align:center;color:var(--text3)">â€”</td>`;
      }).join('')}
    </tr></tbody>
  </table>`;

  // Tabela szczegĂłĹ‚owa
  const sorted = taxes.slice().sort((a,b)=>(b.amount||0)-(a.amount||0));
  document.getElementById('rp-table').innerHTML = `<table>
    <thead><tr>
      <th>Nr rej.</th><th>Marka / Model</th><th>Rok</th><th>Typ</th>
      <th>DMC (kg)</th><th>Status</th><th>WĹ‚aĹ›ciciel</th>
      <th>Kat. DT-1</th><th style="text-align:right">Stawka roczna</th>
      <th style="text-align:right">Podatek</th><th style="text-align:right">I rata</th><th style="text-align:right">II rata</th>
    </tr></thead>
    <tbody>${sorted.map(v=>{
      const r1v=Math.round((v.amount||0)/2), r2v=Math.round(v.amount||0)-r1v;
      const isNew=(parseInt(v.rok)||0)>=2024;
      return `<tr>
        <td><strong style="font-family:var(--mono)">${v.nrRej}</strong></td>
        <td>${v.marka} ${v.model} ${isNew?'<span class="pill pill-new" style="font-size:9px">Â§2</span>':''}</td>
        <td>${v.rok||'â€”'}</td>
        <td><span class="pill pill-gray" style="font-size:10px">${v.typ}</span></td>
        <td style="font-family:var(--mono);font-size:12px">${(v.dmc||0).toLocaleString('pl-PL')}</td>
        <td><span class="pill ${STAT_LABELS[v.status]||'pill-gray'}">${v.status}</span></td>
        <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${v.wlasciciel||'â€”'}</td>
        <td>${v.cat?`<span class="pill ${CAT_COLORS[v.cat]||'pill-gray'}">${v.cat}</span>`:'<span style="color:var(--text3)">â€”</span>'}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--text2)">${v.rate?v.rate.toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
        <td style="text-align:right;font-family:var(--mono);font-weight:600;color:${v.amount>0?'var(--green)':'var(--text3)'}">${v.amount>0?fmt2(v.amount)+' zĹ‚':'â€”'}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--blue)">${v.amount>0?fmtZl(r1v)+' zĹ‚':'â€”'}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--blue)">${v.amount>0?fmtZl(r2v)+' zĹ‚':'â€”'}</td>
      </tr>`;}).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="9" style="font-weight:600;text-align:right;padding:10px 16px">RAZEM:</td>
      <td style="font-weight:700;text-align:right;font-family:var(--mono);color:var(--green);padding:10px 16px">${fmt2(total)} zĹ‚</td>
      <td style="font-weight:700;text-align:right;font-family:var(--mono);color:var(--blue);padding:10px 16px">${fmtZl(r1)} zĹ‚</td>
      <td style="font-weight:700;text-align:right;font-family:var(--mono);color:var(--blue);padding:10px 16px">${fmtZl(r2)} zĹ‚</td>
    </tr></tfoot>
  </table>`;
}

function exportRaport() {
  const list = getRpVehs();
  const taxes = list.map(v=>({...v,...calcTax(v)}));
  const wb = XLSX.utils.book_new();

  // Arkusz 1: Zestawienie gĹ‚Ăłwne
  const hdrs=['Nr rej.','Marka','Model','Rok','Typ','DMC (kg)','Status','WĹ‚aĹ›ciciel','VIN','Kategoria DT-1','Stawka roczna (zĹ‚)','MiesiÄ…ce','Podatek (zĹ‚)','I rata (zĹ‚)','II rata (zĹ‚)','Â§2 (tak/nie)'];
  const rows = taxes.map(v=>{
    const r1v=Math.round((v.amount||0)/2), r2v=Math.round(v.amount||0)-r1v;
    return [v.nrRej,v.marka,v.model,v.rok,v.typ,v.dmc,v.status,v.wlasciciel,v.vin||'',v.cat||'brak',v.rate||0,v.miesiacePodatku||12,Math.round(v.amount*100)/100,r1v,r2v,(parseInt(v.rok)||0)>=2024?'TAK':'NIE'];
  });
  const ws1 = XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  ws1['!cols'] = hdrs.map((_,i)=>({wch:i===1||i===7?18:i===3?6:12}));
  XLSX.utils.book_append_sheet(wb,ws1,'Zestawienie pojazdĂłw');

  // Arkusz 2: Podsumowanie wg marki
  const brands = {};
  taxes.filter(v=>v.cat).forEach(v=>{if(!brands[v.marka])brands[v.marka]={count:0,tax:0};brands[v.marka].count++;brands[v.marka].tax+=v.amount;});
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Marka','Liczba pojazdĂłw','Podatek roczny (zĹ‚)','I rata (zĹ‚)','II rata (zĹ‚)'],
    ...Object.entries(brands).sort((a,b)=>b[1].tax-a[1].tax).map(([m,d])=>[m,d.count,Math.round(d.tax*100)/100,Math.round(d.tax/2),Math.round(d.tax)-Math.round(d.tax/2)])
  ]);
  XLSX.utils.book_append_sheet(wb,ws2,'Wg marki');

  // Arkusz 3: Wg kategorii DT-1
  const cats2 = {};
  taxes.filter(v=>v.cat).forEach(v=>{if(!cats2[v.cat])cats2[v.cat]={count:0,tax:0,label:CAT_LABELS[v.cat]||''};cats2[v.cat].count++;cats2[v.cat].tax+=v.amount;});
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Kategoria DT-1','Opis','Liczba pojazdĂłw','Podatek roczny (zĹ‚)','I rata (zĹ‚)','II rata (zĹ‚)'],
    ...Object.entries(cats2).sort((a,b)=>b[1].tax-a[1].tax).map(([c,d])=>[c,d.label,d.count,Math.round(d.tax*100)/100,Math.round(d.tax/2),Math.round(d.tax)-Math.round(d.tax/2)])
  ]);
  XLSX.utils.book_append_sheet(wb,ws3,'Wg kategorii DT-1');

  // Arkusz 4: Harmonogram
  const yr = document.getElementById('taxYear').value;
  const total = taxes.reduce((s,v)=>s+(v.amount||0),0);
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Termin','Kwota (zĹ‚)','Opis'],
    [`15.02.${yr}`,r1,'I rata podatku od Ĺ›rodkĂłw transportowych (poz. 81 DT-1)'],
    [`15.09.${yr}`,r2,'II rata podatku od Ĺ›rodkĂłw transportowych (poz. 82 DT-1)'],
    ['RAZEM',total,'ĹÄ…czna kwota podatku za rok '+yr+' (poz. 80 DT-1)'],
  ]);
  XLSX.utils.book_append_sheet(wb,ws4,'Harmonogram pĹ‚atnoĹ›ci');

  const yr2 = document.getElementById('taxYear').value;
  XLSX.writeFile(wb,`Raport_DT1_mToilet_${yr2}.xlsx`);
  toast(`âś“ Raport pobrany â€” ${taxes.length} pojazdĂłw, ${fmt2(total)} zĹ‚`);
}

// ==================== OCR ENGINE (Tesseract.js + formularz rÄ™czny) ====================
let ocrFile=null,ocrBase64=null,ocrMime=null,ocrHistory=[],pendingVehId=null,pendingOcrData=null;
let tesseractWorker=null,tesseractReady=false;

// --- Inicjalizacja Tesseract ---
async function initTesseract(){
  if(tesseractReady)return true;
  try{
    tesseractWorker=await Tesseract.createWorker(['pol','eng'],1,{logger:m=>{
      const bar=document.getElementById('ocr-progress-bar');
      const stat=document.getElementById('ocr-status');
      if(bar&&m.progress){bar.style.width=(m.progress*100)+'%';}
      if(stat&&m.status){stat.textContent=({
        'loading tesseract core':'Ĺadowanie silnika OCR...',
        'loading language traineddata':'Ĺadowanie modelu jÄ™zykowego (PL)...',
        'initializing api':'Inicjalizacja API...',
        'recognizing text':'Rozpoznawanie tekstu...'
      }[m.status]||m.status);}
    }});
    tesseractReady=true;
    return true;
  }catch(e){console.error('Tesseract init error:',e);return false;}
}

// --- ObsĹ‚uga pliku ---
function handleFileSelect(input){if(input.files&&input.files[0])processOcrFile(input.files[0]);}
function handleDrop(e){
  e.preventDefault();
  document.getElementById('ocr-dropzone').style.borderColor='var(--border2)';
  document.getElementById('ocr-dropzone').style.background='var(--bg2)';
  if(e.dataTransfer.files[0])processOcrFile(e.dataTransfer.files[0]);
}

function processOcrFile(f){
  if(f.size>20*1024*1024){toast('âš  Plik za duĹĽy â€” maks. 20 MB');return;}
  ocrFile=f; ocrMime=f.type||'image/jpeg';
  const reader=new FileReader();
  reader.onload=async e=>{
    const dataUrl=e.target.result;
    ocrBase64=dataUrl.split(',')[1];
    
    if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){
      // PDF: renderuj pierwszÄ… stronÄ™ do canvas przez PDF.js
      try{
        const pdfjs=await loadPdfJs();
        const loadingTask=pdfjs.getDocument({data:atob(ocrBase64)});
        const pdf=await loadingTask.promise;
        const page=await pdf.getPage(1);
        const viewport=page.getViewport({scale:3.0}); // wysoka rozdzielczoĹ›Ä‡
        const canvas=document.createElement('canvas');
        canvas.width=viewport.width;
        canvas.height=viewport.height;
        const ctx=canvas.getContext('2d');
        await page.render({canvasContext:ctx,viewport}).promise;
        const imgDataUrl=canvas.toDataURL('image/jpeg',0.95);
        ocrBase64=imgDataUrl.split(',')[1];
        ocrMime='image/jpeg';
        document.getElementById('ocr-img').src=imgDataUrl;
        document.getElementById('ocr-img').style.display='block';
        document.getElementById('ocr-img').style.transform='';
        toast('âś… PDF zaĹ‚adowany â€” '+pdf.numPages+' str. | Kliknij "Uruchom OCR"');
        // SprawdĹş teĹĽ stronÄ™ 2 (tylna strona dowodu)
        if(pdf.numPages>1){
          const page2=await pdf.getPage(2);
          const vp2=page2.getViewport({scale:3.0});
          const c2=document.createElement('canvas');
          c2.width=vp2.width;c2.height=vp2.height;
          await page2.render({canvasContext:c2.getContext('2d'),viewport:vp2}).promise;
          window._ocrPage2=c2.toDataURL('image/jpeg',0.95);
          // Pre-OCR page 2 if Tesseract is ready
          if(tesseractReady&&tesseractWorker){
            try{
              const r2=await tesseractWorker.recognize(window._ocrPage2);
              window._ocrPage2Text=r2.data.text||'';
            }catch(e2){}
          }
        }
      }catch(err){
        console.warn('PDF.js error:',err);
        toast('âš  PDF nie mĂłgĹ‚ byÄ‡ wyrenderowany: '+err.message);
        document.getElementById('ocr-img').style.display='none';
      }
    }else if(f.type.startsWith('image/')){
      document.getElementById('ocr-img').src=dataUrl;
      document.getElementById('ocr-img').style.display='block';
    }else{
      document.getElementById('ocr-img').style.display='none';
    }
    document.getElementById('ocr-preview').classList.remove('hidden');
    document.getElementById('ocr-btn-area').classList.remove('hidden');
    document.getElementById('ocr-result').classList.add('hidden');
    document.getElementById('ocr-result').innerHTML='';
  };
  reader.readAsDataURL(f);
}

let _pdfJsLoaded=false,_pdfJsLib=null;
async function loadPdfJs(){
  if(_pdfJsLoaded)return _pdfJsLib;
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
    s.type='module';
    s.onload=()=>{};
    // Use legacy build instead
    const s2=document.createElement('script');
    s2.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    s2.onload=()=>{
      const lib=window.pdfjsLib;
      if(!lib){rej(new Error('pdfjsLib nie zaĹ‚adowany'));return;}
      lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      _pdfJsLib=lib;_pdfJsLoaded=true;res(lib);
    };
    s2.onerror=()=>rej(new Error('Nie moĹĽna zaĹ‚adowaÄ‡ PDF.js'));
    document.head.appendChild(s2);
  });
}

function resetOCR(){
  ocrFile=null;ocrBase64=null;
  document.getElementById('ocr-preview').classList.add('hidden');
  document.getElementById('ocr-btn-area').classList.add('hidden');
  document.getElementById('ocr-result').classList.add('hidden');
  document.getElementById('ocr-result').innerHTML='';
  document.getElementById('ocr-file').value='';
  document.getElementById('ocr-img').src='';
  document.getElementById('ocr-loader').classList.add('hidden');
}

// --- GĹĂ“WNA FUNKCJA OCR ---
async function runOCR(){
  if(!ocrBase64&&!ocrFile){showManualForm({});return;}
  const btn=document.getElementById('ocr-btn');
  btn.disabled=true;
  btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> AnalizujÄ™...';
  document.getElementById('ocr-loader').classList.remove('hidden');
  document.getElementById('ocr-btn-area').classList.add('hidden');
  document.getElementById('ocr-result').classList.add('hidden');

  try{
    // Ĺaduj Tesseract jeĹ›li trzeba
    const bar=document.getElementById('ocr-progress-bar');
    bar.style.width='5%';
    const ok=await initTesseract();
    if(!ok)throw new Error('Nie udaĹ‚o siÄ™ zaĹ‚adowaÄ‡ silnika OCR');

    // Rozpoznaj tekst
    bar.style.width='20%';
    const imgSrc='data:'+ocrMime+';base64,'+ocrBase64;
    const result=await tesseractWorker.recognize(imgSrc);
    bar.style.width='35%';

    // OCR przy 180Â° (MRZ czytelniejszy)
    let rawText180='';
    try{
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      const img2=new Image();
      await new Promise(r=>{img2.onload=r;img2.src=imgSrc;});
      canvas.width=img2.width;canvas.height=img2.height;
      ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(Math.PI);
      ctx.drawImage(img2,-img2.width/2,-img2.height/2);
      const r180=await tesseractWorker.recognize(canvas.toDataURL('image/jpeg',0.9));
      rawText180=r180.data.text||'';
    }catch(e2){}
    bar.style.width='50%';

    // OCR top/bot halves at 90Â° (pola F1/F2/L etc. sÄ… pionowo)
    let rawTextCrops='';
    try{
      const img3=new Image();
      await new Promise(r=>{img3.onload=r;img3.src=imgSrc;});
      const W=img3.width,H=img3.height;
      for(const[sy,ey,angle] of [[0,H/2,90],[H/2,H,90],[W/3,2*W/3,90].map(()=>null)].flat()){
        if(!sy&&sy!==0)continue;
        const c=document.createElement('canvas');
        const cx=c.getContext('2d');
        // Crop top half rotated 90Â°
        if(sy!==undefined){
          const cropH=ey-sy;
          c.width=cropH;c.height=W;
          cx.translate(c.width/2,c.height/2);cx.rotate(Math.PI/2);
          cx.drawImage(img3,0,-sy,-W/2,-cropH/2,W,cropH);
          // Fix: simpler crop+rotate approach
          const c2=document.createElement('canvas');c2.width=W;c2.height=cropH;
          c2.getContext('2d').drawImage(img3,0,0,W,H,0,-sy,W,H);
          const cr=document.createElement('canvas');cr.width=cropH;cr.height=W;
          const crx=cr.getContext('2d');
          crx.translate(cr.width/2,cr.height/2);crx.rotate(Math.PI/2);
          crx.drawImage(c2,0,sy,-W/2,-cropH/2,W,cropH);
          try{
            const rc=await tesseractWorker.recognize(cr.toDataURL('image/jpeg',0.9));
            rawTextCrops+='\n---crop'+sy+'_90---\n'+(rc.data.text||'');
          }catch(e3){}
        }
      }
    }catch(e4){}
    bar.style.width='70%';
    bar.style.width='85%';
    const rawText=result.data.text||'';
    // OCR 180Â° wykonany wczeĹ›niej â€” uĹĽywamy rawText180 z pierwszego przebiegu.
    // PoĹ‚Ä…cz oba teksty
    const combinedText='---0---\n'+rawText+'\n---180---\n'+rawText180+rawTextCrops+(window._ocrPage2Text?'\n---page2---\n'+window._ocrPage2Text:'');
    const conf=result.data.confidence||0;

    // Parsuj tekst
    const parsed=parseRegistrationDoc(combinedText||rawText);
    parsed._rawText=rawText;
    parsed._confidence=conf;
    bar.style.width='100%';

    setTimeout(()=>{
      document.getElementById('ocr-loader').classList.add('hidden');
      showManualForm(parsed,rawText,conf);
    },400);

  }catch(e){
    document.getElementById('ocr-loader').classList.add('hidden');
    document.getElementById('ocr-btn-area').classList.remove('hidden');
    btn.disabled=false;
    btn.innerHTML='<i class="ti ti-scan"></i> Uruchom OCR + WypeĹ‚nij formularz';
    // PokaĹĽ formularz rÄ™czny z komunikatem bĹ‚Ä™du
    document.getElementById('ocr-result').classList.remove('hidden');
    document.getElementById('ocr-result').innerHTML=`<div class="wbox" style="margin-bottom:12px"><i class="ti ti-alert-triangle"></i><div><strong>OCR nie mĂłgĹ‚ przetworzyÄ‡ pliku:</strong> ${e.message}<br><span style="font-size:11px">Formularz rÄ™czny jest dostÄ™pny poniĹĽej â€” wpisz dane z dokumentu.</span></div></div>`;
    showManualForm({});
  }
  document.getElementById('ocr-btn').disabled=false;
  document.getElementById('ocr-btn').innerHTML='<i class="ti ti-scan"></i> Uruchom OCR + WypeĹ‚nij formularz';
}

// --- PARSER POLSKIEGO DOWODU REJESTRACYJNEGO ---
function parseRegistrationDoc(combinedOcrText){
  const t = combinedOcrText||'';
  const d = {};

  // ============================================================
  // 1. MRZ â€” z sekcji obrotu 180Â° (najdokĹ‚adniejsza)
  // ============================================================
  function normMRZ(line){
    return line.toUpperCase().replace(/[()\[\]{}]/g,'<').replace(/\|/g,'1')
               .replace(/[^A-Z0-9<]/g,'<');
  }
  function getMRZ(src){
    const lines=src.split('\n').map(l=>l.trim()).filter(l=>l.length>=10);
    let l2='',l3='';
    for(const line of lines){
      const n=normMRZ(line);
      if(!n.includes('<'))continue;
      if(/^[A-Z]{2,3}\d{4,5}[A-Z]?<<</.test(n)&&!l3)l3=n;
      const pot=n.replace(/<.*$/,'').substring(0,17);
      if(pot.length>=11&&/^[A-HJ-NPR-Z0-9]{11,17}/.test(pot)&&!l2)l2=n;
    }
    return{l2,l3};
  }
  // ZnajdĹş sekcje z rĂłĹĽnych kÄ…tĂłw
  const parts={};
  for(const sec of t.split(/---(\w+)---\n/)){
    if(sec.startsWith('---'))continue;
    if(parts._last)parts[parts._last]=sec;
    parts._last=sec;
  }
  // SprĂłbuj MRZ ze wszystkich sekcji, priorytet 180Â°
  let mrzLine2='',mrzLine3='';
  for(const key of ['180','270','0','90','top_half_90','bot_half_270']){
    const src=t.split(`---${key}---\n`)[1]||'';
    const{l2,l3}=getMRZ(src);
    if(!mrzLine3&&l3)mrzLine3=l3;
    if(!mrzLine2&&l2)mrzLine2=l2;
    if(mrzLine2&&mrzLine3)break;
  }
  // Fallback: szukaj w caĹ‚ym tekĹ›cie
  if(!mrzLine3||!mrzLine2){
    const{l2,l3}=getMRZ(t);
    if(!mrzLine3)mrzLine3=l3;
    if(!mrzLine2)mrzLine2=l2;
  }
  if(mrzLine3){const m=mrzLine3.match(/^([A-Z]{2,3}\d{4,5}[A-Z]?)<<</);if(m)d.nrRej=m[1];}
  if(mrzLine2){const v=mrzLine2.replace(/[^A-HJ-NPR-Z0-9]/g,'').substring(0,17);if(v.length===17)d.vin=v;}

  // ============================================================
  // 2. Typ dokumentu: staĹ‚y vs tymczasowy
  // ============================================================
  d.typDok=/CZASOW|PC.AAK|POZWOLENIE CZASOWE/i.test(t)?'TYMCZASOWY':'STAĹY';

  // ============================================================
  // 3. Data rejestracji (pole B)
  // ============================================================
  const allDates=t.match(/\b(\d{2}[.\-]\d{2}[.\-]20\d{2})\b/g)||[];
  if(allDates.length){
    // Pierwsza peĹ‚na data to zazwyczaj data rejestracji
    const validDates=allDates.filter(d=>{const y=parseInt(d.slice(-4));return y>=1990&&y<=2030;});
    if(validDates.length)d.dataRej=validDates[0].replace(/-/g,'.');
  }

  // ============================================================
  // 4. DMC (F1, F2, F3) â€” szukaj linii z 2-3 duĹĽymi liczbami
  // ============================================================
  // Wzorzec: "F1 5500 kg | F2 5500 kg | F3 7000 kg"
  // OCR moĹĽe myliÄ‡ "F1" z "8", "Fi", "Ft" itp.
  // Szukaj linii zawierajÄ…cych 2+ liczb w zakresie 1000-100000 z 'kg'
  const flineMatch=t.match(/(\d{3,6})\s*[kK][gG][^a-z]{0,20}(\d{3,6})\s*[kK][gG][^a-z]{0,20}(\d{3,6})\s*[kK][gG]/i);
  if(flineMatch){
    const nums=[parseInt(flineMatch[1]),parseInt(flineMatch[2]),parseInt(flineMatch[3])];
    const valid=nums.filter(n=>n>=500&&n<=120000);
    if(valid.length>=1)d.dmcKg=String(valid[0]);
    if(valid.length>=3)d.dmcZespolu=String(valid[2]);
  } else {
    // Fallback: szukaj pojedynczych wartoĹ›ci
    const f1=t.match(/F\.?[t1iI]\s*[:\|]?\s*(\d{3,6})\s*[kK][gG]/i);
    if(f1)d.dmcKg=f1[1];
    const f3=t.match(/F\.?3\s*[:\|]?\s*(\d{3,6})\s*[kK][gG]/i);
    if(f3)d.dmcZespolu=f3[1];
  }

  // ============================================================
  // 5. Marka (D.1) i Model/Typ (D.2)
  // ============================================================
  const BRANDS=['MERCEDES-BENZ','MERCEDES','SCANIA','VOLVO','MAN TGL','MAN TGX','MAN TGS',
    'MAN','DAF','IVECO','RENAULT','FORD','FIAT','BMW','VOLKSWAGEN','CITROEN','PEUGEOT',
    'OPEL','TOYOTA','NISSAN','MITSUBISHI','ISUZU','HINO'];
  for(const brand of BRANDS){
    const re2=new RegExp(brand.replace('-','[-/]?'),'i');
    if(re2.test(t)){
      d.marka=brand.split(/[-\s]/)[0].toUpperCase();
      // Szukaj modelu po marce
      const mM=t.match(new RegExp(brand+'[/\\s\\-]*([A-Z0-9]{2,12})','i'));
      if(mM&&mM[1]&&mM[1]!=='SP')d.typ=mM[1].toUpperCase();
      break;
    }
  }
  // Dodatkowe szukanie D.1 i D.2 z kodami formularza
  const d1M=t.match(/D\.?1\s*[:\|]?\s*([A-Z][A-Z\-]{2,20}?)(?:\s*[\/\|]|\n|$)/im);
  if(d1M&&!d.marka)d.marka=d1M[1].trim().toUpperCase();
  const d2M=t.match(/D\.?2\s*[:\|]?\s*([A-Z0-9][A-Za-z0-9\-\s]{1,20}?)(?:\n|D\.|$)/im);
  if(d2M&&!d.typ)d.typ=d2M[1].trim();

  // ============================================================
  // 6. Liczba osi (L) â€” bezpieczny zakres 1-5
  // ============================================================
  const osiM=t.match(/\bL\s*[:\|=]?\s*([1-5])\b(?!\d)/i);
  if(osiM)d.liczbaOsi=osiM[1];

  // ============================================================
  // 7. Kategoria pojazdu (J) â€” N1/N2/N3/M1/M2/M3/O1-4
  // ============================================================
  const katM=t.match(/\bJ\s*[:\|]?\s*(N[123]|M[123]|O[1-4])\b/i)
    ||t.match(/(?:^|\|)\s*(N[123]|M[123])\s*(?:\||$)/m);
  if(katM)d.kategoria=(katM[1]||katM[2]||'').toUpperCase();

  // ============================================================
  // 8. Silnik: P.1 pojemnoĹ›Ä‡, P.2 moc, P.3 paliwo
  // ============================================================
  const p1M=t.match(/P\.?1\s*[:\|]?\s*(\d{3,5})[,\.]\d{2}\s*cm/i)
    ||t.match(/(\d{3,5})[,\.]\d{2}\s*cm[Âł3]/i);
  if(p1M)d.pojSilnika=p1M[1];
  const p2M=t.match(/P\.?2\s*[:\|]?\s*(\d{2,4})[,\.]\d{2}\s*kW/i)
    ||t.match(/(\d{2,4})[,\.]\d{2}\s*kW/i);
  if(p2M)d.mocKW=p2M[1];
  const p3M=t.match(/P\.?3\s*[:\|]?\s*([A-Z])\b/i);
  if(p3M){
    const fuel=p3M[1].toUpperCase();
    d.paliwo=fuel==='D'?'ON (Olej napÄ™dowy)':fuel==='G'?'LPG':
             fuel==='B'?'PB (Benzyna)':fuel==='E'?'Elektryczny':fuel;
  }

  // ============================================================
  // 9. Masa wĹ‚asna (G) i miejsca siedzÄ…ce (S.1)
  // ============================================================
  const gM=t.match(/\bG\s*[:\|]?\s*(\d{3,6})\s*[kK][gG]/i);
  if(gM)d.masaWlKg=gM[1];
  const s1M=t.match(/S\.?1\s*[:\|]?\s*(\d{1,3})\b/i);
  if(s1M)d.miejscaSied=s1M[1];

  // ============================================================
  // 10. Rok produkcji
  // ============================================================
  const rokMs=t.match(/\b(19[89]\d|20[012]\d)\b/g)||[];
  const validRok=rokMs.filter(y=>parseInt(y)>=1990&&parseInt(y)<=2030);
  if(validRok.length)d.rokProd=validRok[0];

  // ============================================================
  // 11. Norma Euro (ze strony 2)
  // ============================================================
  const euroM=t.match(/EURO\s*([IVX0-9]+(?:\s*D[-+]?)?)/i);
  if(euroM)d.euroNorma='Euro '+euroM[1].toUpperCase().trim();

  // Zawieszenie
  if(/pneumat/i.test(t))d.rodzajZawieszenia='pneumatyczne';
  else if(/r[oĂł]wnowa[ĹĽz]/i.test(t))d.rodzajZawieszenia='rĂłwnowaĹĽne z pneumatycznym';

  // Walidacja VIN
  if(d.vin&&(d.vin.length!==17||!/^[A-HJ-NPR-Z0-9]{17}$/.test(d.vin)))delete d.vin;

  // PewnoĹ›Ä‡
  const found=[d.nrRej,d.vin,d.marka,d.dmcKg,d.dataRej].filter(Boolean).length;
  d.pewnosc=found>=4?'WYSOKA':found>=2?'SREDNIA':'NISKA';
  return d;
}




// --- FORMULARZ RÄCZNY Z WYNIKAMI OCR ---
function showManualForm(d,rawText,conf){
  document.getElementById('ocr-result').classList.remove('hidden');
  const confInfo=conf!=null?`<span style="font-size:11px;font-family:var(--mono);color:var(--text2)">PewnoĹ›Ä‡ Tesseract: ${Math.round(conf)}%</span>`:'';
  const pewClass={WYSOKA:'gbox',SREDNIA:'ibox',NISKA:'wbox'}[d.pewnosc]||'ibox';
  const pewIcon={WYSOKA:'ti-circle-check',SREDNIA:'ti-scan',NISKA:'ti-alert-triangle'}[d.pewnosc]||'ti-scan';

  let html='';

  if(rawText!==undefined){
    html+=`<div class="${pewClass}" style="margin-bottom:12px">
      <i class="ti ${pewIcon}"></i>
      <div>
        <strong>OCR zakoĹ„czony â€” pewnoĹ›Ä‡: ${d.pewnosc||'?'}</strong> Â· ${confInfo}<br>
        <span style="font-size:11px">SprawdĹş poniĹĽsze pola i popraw jeĹ›li OCR siÄ™ pomyliĹ‚. NastÄ™pnie kliknij <strong>Szukaj i aktualizuj</strong>.</span>
      </div>
    </div>`;
    // Surowy tekst (zwijany)
    html+=`<details style="margin-bottom:12px">
      <summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:6px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">đź“„ Surowy tekst OCR (kliknij aby rozwinÄ…Ä‡)</summary>
      <pre style="font-size:10px;font-family:var(--mono);background:var(--bg3);padding:10px;border-radius:var(--radius);max-height:200px;overflow-y:auto;margin-top:4px;white-space:pre-wrap;color:var(--text2)">${(rawText||'').replace(/</g,'&lt;').slice(0,3000)}</pre>
    </details>`;
  }else{
    html+=`<div class="ibox" style="margin-bottom:12px"><i class="ti ti-forms"></i><div><strong>Formularz rÄ™czny</strong> â€” wpisz dane z dowodu rejestracyjnego. Pola odpowiadajÄ… polom formularza DT-1/A.</div></div>`;
  }

  // Formularz pĂłl
  const field=(id,label,placeholder,val,hint)=>`
    <div class="f">
      <label>${label}${hint?`<span style="font-size:10px;font-weight:400;color:var(--text3);margin-left:6px">${hint}</span>`:''}</label>
      <input id="ocrf-${id}" class="fi" placeholder="${placeholder}" value="${val||''}"
        style="${val&&val!=='null'&&val!=='undefined'?'border-color:var(--green);background:#f0fff0':''}"
        oninput="document.getElementById('ocrf-${id}').style.borderColor='var(--border)';document.getElementById('ocrf-${id}').style.background='var(--bg2)'">
    </div>`;

  html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
      <i class="ti ti-forms" style="color:var(--blue)"></i>Dane z dowodu rejestracyjnego
      <span style="font-size:11px;font-weight:400;color:var(--text2)">â€” pola podĹ›wietlone na zielono zostaĹ‚y rozpoznane automatycznie</span>
    </div>

    <div style="background:var(--blue-light);border-radius:var(--radius);padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--blue-dark)">
      <strong>Legenda pĂłl:</strong> A=Nr rej. Â· B=Data 1.rej. Â· D.1=Marka Â· D.2=Typ Â· E=VIN Â· F.1=DMC (kg) Â· F.3=DMC zesp. Â· L=Osie Â· P.3=Paliwo Â· J=Kategoria Â· S.1=Miejsca
    </div>

    <div class="fg" style="gap:12px">
      ${field('nrRej','đź”‘ A â€” Numer rejestracyjny','np. WA4789F',d.nrRej,'wymagane')}
      ${field('dataRej','đź“… B â€” Data 1. rejestracji w RP','np. 15.03.2021',d.dataRej,'DD.MM.RRRR')}
      ${field('marka','đźš› D.1 â€” Marka','np. SCANIA',d.marka,'')}
      ${field('typ','D.2 â€” Typ / Model','np. R540',d.typ,'')}
      ${field('vin','đź”˘ E â€” Numer VIN','17 znakĂłw',d.vin,'17 znakĂłw')}
      ${field('dmcKg','âš–ď¸Ź F.1 â€” DMC pojazdu (kg)','np. 27000',d.dmcKg,'kg')}
      ${field('dmcZespolu','F.3 â€” DMC zespoĹ‚u pojazdĂłw (kg)','np. 40000',d.dmcZespolu,'kg â€” dla przyczep!')}
      ${field('masaWlKg','G â€” Masa wĹ‚asna (kg)','np. 8200',d.masaWlKg,'kg')}
      ${field('liczbaOsi','L â€” Liczba osi pojazdu','np. 2',d.liczbaOsi,'1â€“5')}
      <div class="f">
        <label>Rodzaj zawieszenia</label>
        <select id="ocrf-zawieszenie" class="fi">
          <option value="pneumatyczne" ${(d.rodzajZawieszenia||'').includes('pneu')?'selected':''}>Pneumatyczne</option>
          <option value="rĂłwnowaĹĽne" ${(d.rodzajZawieszenia||'').includes('r'+'Ăłwno')?'selected':''}>RĂłwnowaĹĽne z pneumatycznym</option>
          <option value="inne" ${!d.rodzajZawieszenia||d.rodzajZawieszenia==='inne'?'selected':''}>Inny system</option>
        </select>
      </div>
      ${field('paliwo','P.3 â€” Rodzaj paliwa','np. ON lub PB',d.paliwo,'')}
      ${field('pojSilnika','P.1 â€” PojemnoĹ›Ä‡ (cmÂł)','np. 12742',d.pojSilnika,'cmÂł')}
      ${field('mocKW','P.2 â€” Moc silnika (kW)','np. 397',d.mocKW,'kW')}
      ${field('miejscaSied','S.1 â€” Miejsca siedzÄ…ce','np. 3',d.miejscaSied,'bez kier.')}
      ${field('kategoria','J â€” Kategoria pojazdu','np. N3',d.kategoria,'N1/N2/N3/O/M')}
      ${field('rokProd','Rok produkcji','np. 2021',d.rokProd,'')}
    </div>
  </div>

  <button class="btn btn-blue" style="width:100%;justify-content:center;padding:13px;font-size:14px;margin-bottom:8px" onclick="submitManualForm()">
    <i class="ti ti-search"></i>Szukaj pojazdu w bazie i porĂłwnaj dane
  </button>
  <div style="font-size:11px;color:var(--text3);text-align:center">Program przeszuka bazÄ™ wg numeru rejestracyjnego i pokaĹĽe co siÄ™ zmieniĹ‚o</div>`;

  document.getElementById('ocr-result').innerHTML=html;

  // Dodaj do historii
  if(d.nrRej){
    ocrHistory.unshift({ts:new Date().toLocaleTimeString('pl-PL'),nrRej:d.nrRej,marka:d.marka||'',pewnosc:d.pewnosc||'?',found:false});
    renderOcrHistory();
  }
}

// --- PRZETWORZENIE FORMULARZA ---
function submitManualForm(){
  const g=id=>document.getElementById('ocrf-'+id)?.value?.trim()||null;
  const d={
    nrRej:g('nrRej'),dataRej:g('dataRej'),marka:g('marka'),typ:g('typ'),vin:g('vin'),
    dmcKg:g('dmcKg'),dmcZespolu:g('dmcZespolu'),masaWlKg:g('masaWlKg'),
    liczbaOsi:g('liczbaOsi'),zawieszenie:document.getElementById('ocrf-zawieszenie')?.value||'pneumatyczne',
    paliwo:g('paliwo'),pojSilnika:g('pojSilnika'),mocKW:g('mocKW'),
    miejscaSied:g('miejscaSied'),kategoria:g('kategoria'),rokProd:g('rokProd'),
    pewnosc:'FORMULARZ',typDokumentu:ocrFile?'SKAN':'RÄCZNY'
  };
  if(!d.nrRej){toast('âš  Wpisz numer rejestracyjny');return;}
  pendingOcrData=d;

  // Szukaj w bazie
  const nrRej=d.nrRej.toUpperCase().replace(/\s/g,'');
  const found=vehs.find(v=>v.nrRej.toUpperCase().replace(/\s/g,'')===nrRej);

  // Aktualizuj historiÄ™
  const h=ocrHistory.find(h=>h.nrRej===d.nrRej);
  if(h)h.found=!!found;
  renderOcrHistory();

  if(found){
    openUpdateModal(found.id,d);
  }else if(d.dmcKg&&parseFloat(d.dmcKg)>3500){
    const res=document.getElementById('ocr-result');
    const div=document.createElement('div');
    div.className='wbox'; div.style.marginTop='12px';
    div.innerHTML=`<i class="ti ti-alert-triangle"></i><div><strong>Pojazd ${nrRej} nie znaleziony w bazie.</strong> DMC: ${d.dmcKg} kg â€” podlega podatkowi DT-1.<br>
      <button class="btn btn-green" style="margin-top:8px" onclick="addNewFromOCR(${JSON.stringify(d).replace(/"/g,'&quot;')})"><i class="ti ti-plus"></i>Dodaj jako nowy pojazd</button></div>`;
    res.appendChild(div);
    div.scrollIntoView({behavior:'smooth'});
  }else{
    toast('âš  Pojazd '+nrRej+' nie znaleziony w bazie');
  }
}

// --- MODAL PORĂ“WNANIA ---
function openUpdateModal(vehId,d){
  const v=vehs.find(x=>x.id===vehId);
  if(!v)return;
  pendingVehId=vehId;

  const map=[
    {label:'VIN (E)',key:'vin',newVal:d.vin},
    {label:'DMC pojazdu kg (F.1)',key:'dmc',newVal:d.dmcKg?parseFloat(d.dmcKg):null},
    {label:'DMC zesp. kg (F.3)',key:'dmcZespolu',newVal:d.dmcZespolu?parseFloat(d.dmcZespolu):null},
    {label:'Liczba osi (L)',key:'osie',newVal:d.liczbaOsi?parseInt(d.liczbaOsi):null},
    {label:'Zawieszenie (Â§17)',key:'zawieszenie',newVal:d.zawieszenie},
    {label:'Rok produkcji',key:'rok',newVal:d.rokProd?parseInt(d.rokProd):null},
    {label:'Marka (D.1)',key:'marka',newVal:d.marka},
    {label:'Model (D.2)',key:'model',newVal:d.typ},
    {label:'Data 1. rejestracji',key:'dataRejestracji',newVal:d.dataRej},
  ].filter(c=>c.newVal!==null&&c.newVal!==undefined&&String(c.newVal).trim()!=='');

  const changes=map.map(c=>({...c,oldVal:v[c.key]||'â€”',changed:String(c.newVal).trim()!==String(v[c.key]||'').trim()}));
  const changedCount=changes.filter(c=>c.changed).length;

  document.getElementById('ocr-modal-body').innerHTML=`
    <div style="background:var(--blue-light);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--blue-dark)">
      <strong>${v.nrRej} Â· ${v.marka} ${v.model}</strong><br>
      <span style="font-size:11px">ĹąrĂłdĹ‚o: ${d.typDokumentu||'formularz'} Â· PewnoĹ›Ä‡: ${d.pewnosc||'?'} Â· ${changedCount} ${changedCount===1?'zmiana':'zmiany'} do zastosowania</span>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:36px 160px 1fr 1fr;background:var(--bg3);border-bottom:1px solid var(--border)">
        <div style="padding:8px"></div>
        <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">Pole DT-1</div>
        <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">đź“‹ W bazie</div>
        <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--green)">đź“„ Z dokumentu</div>
      </div>
      ${changes.map((c,i)=>`
      <div style="display:grid;grid-template-columns:36px 160px 1fr 1fr;border-bottom:0.5px solid var(--border);align-items:center;${c.changed?'background:var(--blue-light)':''}">
        <div style="padding:8px;text-align:center"><input type="checkbox" id="ch2-${i}" ${c.changed?'checked':''} style="cursor:pointer"></div>
        <div style="padding:8px 12px;font-size:12px;font-weight:500">${c.label}</div>
        <div style="padding:8px 12px;font-size:12px;font-family:var(--mono);color:var(--text2)">${c.oldVal}</div>
        <div style="padding:8px 12px;font-size:12px;font-family:var(--mono);font-weight:600;color:${c.changed?'var(--blue)':'var(--text)'}">${c.newVal}
          ${c.changed?'<span class="diff-badge">ZMIANA</span>':''}</div>
      </div>`).join('')}
    </div>
    <div class="ibox"><i class="ti ti-info-circle"></i><span>Odznacz pola ktĂłrych <strong>nie</strong> chcesz aktualizowaÄ‡. Zalecamy weryfikacjÄ™ z oryginaĹ‚em dokumentu.</span></div>`;

  document.getElementById('ocr-apply-btn').onclick=()=>applyOcrChanges(vehId,changes);
  document.getElementById('ocr-modal').classList.remove('hidden');
}

function applyOcrChanges(vehId,changes){
  const v=vehs.find(x=>x.id===vehId);
  if(!v)return;
  let applied=0;
  changes.forEach((c,i)=>{
    const chk=document.getElementById('ch2-'+i);
    if(chk&&chk.checked){v[c.key]=c.newVal;applied++;}
  });
  document.getElementById('ocr-modal').classList.add('hidden');
  toast(`âś“ Zaktualizowano ${applied} pĂłl â€” ${v.nrRej}`);
  renderVeh();updateCounters();
  if(ocrHistory[0])ocrHistory[0].applied=applied;
  renderOcrHistory();
  // PokaĹĽ komunikat sukcesu
  const res=document.getElementById('ocr-result');
  if(res){
    const msg=document.createElement('div');
    msg.className='gbox';msg.style.marginBottom='12px';
    msg.innerHTML=`<i class="ti ti-circle-check"></i><strong>âś“ Zaktualizowano ${applied} pĂłl dla ${v.nrRej}.</strong> SprawdĹş wyniki w zakĹ‚adce <button class="btn btn-gray" style="padding:3px 8px;font-size:11px;margin-left:4px" onclick="showPage('pojazdy')">Pojazdy</button>`;
    res.prepend(msg);
    res.scrollIntoView({behavior:'smooth'});
  }
}

function addNewFromOCR(d){
  const dmc=parseFloat((d.dmcKg||'').toString().replace(',','.'))||0;
  if(dmc<=3500){toast('âš  DMC â‰¤ 3500 kg â€” pojazd nie podlega DT-1');return;}
  const newVeh={
    id:vehs.length,
    nrRej:(d.nrRej||'NOWY').toUpperCase().replace(/\s/g,''),
    marka:(d.marka||'Nieznana').toUpperCase(),
    model:d.typ||'â€”',
    rok:parseInt(d.rokProd)||0,
    typ:mapKatToTyp(d.kategoria),
    dmc,euro:'',vin:d.vin||'',
    status:'WĹ‚asny',wlasciciel:'mToilet',
    osie:parseInt(d.liczbaOsi)||2,
    zawieszenie:d.zawieszenie||'pneumatyczne',
    dmcZespolu:parseFloat((d.dmcZespolu||'').toString().replace(',','.'))||0,
    miesiacePodatku:12,
    dataRejestracji:d.dataRej||''
  };
  vehs.push(newVeh);
  selected.add(newVeh.id);
  toast(`âś“ Dodano ${newVeh.nrRej} â€” ${newVeh.marka} ${newVeh.model}`);
  renderVeh();updateCounters();showPage('pojazdy');
}

function mapKatToTyp(kat){
  const k=(kat||'').toUpperCase();
  if(['N2','N3'].includes(k))return 'CiÄ™ĹĽarowy';
  if(k==='N1')return 'CiÄ™ĹĽarowy';
  if(['O1','O2','O3','O4'].some(x=>k.startsWith(x)))return 'Przyczepa';
  if(['M2','M3'].includes(k))return 'Autobus';
  return 'CiÄ™ĹĽarowy';
}

function renderOcrHistory(){
  const el=document.getElementById('ocr-history');
  if(!el)return;
  if(!ocrHistory.length){el.innerHTML='<span style="color:var(--text3);font-size:12px">Brak historii w tej sesji</span>';return;}
  el.innerHTML=ocrHistory.slice(0,8).map(h=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border);font-size:12px">
      <i class="ti ti-scan" style="color:var(--text3)"></i>
      <div style="flex:1"><strong>${h.nrRej||'?'}</strong> <span style="color:var(--text2)">${h.marka||''}</span>
        <div style="font-size:10px;color:var(--text3)">${h.ts} Â· ${h.pewnosc||''}</div></div>
      <span class="pill ${h.found?'pill-green':'pill-amber'}" style="font-size:10px">${h.found?'Znaleziony':'Nowy'}</span>
      ${h.applied!=null?`<span class="pill pill-blue" style="font-size:10px">${h.applied} zm.</span>`:''}
    </div>`).join('');
}


// ==================== FAKTURY (Invoice OCR) ====================
let fakHistory = [], fakOcrWorkerReady = false;

function fakHandleDrop(e) {
  e.preventDefault();
  document.getElementById('fak-drop').style.borderColor='var(--border2)';
  document.getElementById('fak-drop').style.background='var(--bg2)';
  if(e.dataTransfer.files[0]) fakProcessFile(e.dataTransfer.files[0]);
}
function fakHandleFile(inp) { if(inp.files[0]) fakProcessFile(inp.files[0]); }

async function fakProcessFile(f) {
  if(f.size>10*1024*1024){toast('âš  Plik za duĹĽy');return;}
  document.getElementById('fak-loader').classList.remove('hidden');
  document.getElementById('fak-bar').style.width='10%';
  document.getElementById('fak-form').classList.add('hidden');
  const reader=new FileReader();
  reader.onload=async e=>{
    const b64=e.target.result.split(',')[1];
    const mime=f.type||'image/jpeg';
    try {
      if(!tesseractReady) await initTesseract();
      document.getElementById('fak-bar').style.width='40%';
      const imgSrc='data:'+mime+';base64,'+b64;
      const result=await tesseractWorker.recognize(imgSrc);
      document.getElementById('fak-bar').style.width='90%';
      const parsed=parseFaktura(result.data.text||'');
      setTimeout(()=>{
        document.getElementById('fak-loader').classList.add('hidden');
        fakShowForm(parsed, result.data.text);
      },400);
    } catch(err) {
      document.getElementById('fak-loader').classList.add('hidden');
      fakShowForm({});
      toast('âš  OCR nie powiĂłdĹ‚ siÄ™ â€” wypeĹ‚nij formularz rÄ™cznie');
    }
  };
  reader.readAsDataURL(f);
}

function parseFaktura(txt) {
  const d={};
  const t=txt.replace(/\r/g,'\n');
  // Numer faktury
  const nrFak=t.match(/(?:faktura|nr|fv)[^\n]*?(FV|VAT|FS)?[-\/\s]?(\d{1,6}[\/\-]\d{2,4}(?:[\/\-]\d{2,4})?)/i);
  if(nrFak) d.nrFaktury=nrFak[0].trim().slice(0,40);
  // Data
  const dates=t.match(/\d{2}[.\-\/]\d{2}[.\-\/]\d{4}/g)||[];
  if(dates.length) d.data=dates[0];
  if(dates.length>1) d.dataSprzedazy=dates[1];
  // Ceny
  const netto=t.match(/(?:netto|wartoĹ›Ä‡ netto|razem netto)[:\s]+(\d[\d\s,\.]+)/i);
  if(netto) d.cenaNetto=netto[1].replace(/\s/g,'').replace(',','.');
  const brutto=t.match(/(?:brutto|do zapĹ‚aty|razem brutto|Ĺ‚Ä…cznie)[:\s]+(\d[\d\s,\.]+)/i);
  if(brutto) d.cenaBrutto=brutto[1].replace(/\s/g,'').replace(',','.');
  // NIP sprzedawcy
  const nipMatch=t.match(/(?:NIP|nip)[:\s]*(\d{3}[\-\s]?\d{3}[\-\s]?\d{2}[\-\s]?\d{2})/);
  if(nipMatch) d.nipSprzedawcy=nipMatch[1].replace(/[\s\-]/g,'');
  // Nazwa sprzedawcy (linia po "Sprzedawca:")
  const sprzMatch=t.match(/(?:sprzedawca|wystawca|nabywca)[:\s\n]+([^\n]{5,60})/i);
  if(sprzMatch) d.sprzedawca=sprzMatch[1].trim();
  // Nr rejestracyjny w opisie
  const plates=t.match(/\b([A-Z]{2,3}\s?\d{4,5}[A-Z]?)\b/g)||[];
  if(plates.length) d.nrRej=plates[0].replace(/\s/g,'').toUpperCase();
  // Typ zdarzenia
  d.typZdarzenia=t.match(/sprzeda[ĹĽz]|zby[Ä‡c]/i)?'SPRZEDAĹ»':'ZAKUP';
  return d;
}

function fakShowForm(d, rawText) {
  const el=document.getElementById('fak-form');
  el.classList.remove('hidden');
  const fld=(id,lbl,val,ph,hint)=>`<div class="f">
    <label>${lbl}${hint?`<span style="font-size:10px;color:var(--text3);margin-left:5px">${hint}</span>`:''}  </label>
    <input id="fakf-${id}" class="fi" value="${val||''}" placeholder="${ph}"
      style="${val?'border-color:var(--green);background:#f0fff0':''}">
  </div>`;

  el.innerHTML=`
    ${rawText?`<details style="margin-bottom:10px"><summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:6px;background:var(--bg3);border-radius:var(--radius)">đź“„ Surowy tekst OCR (rozwiĹ„)</summary>
      <pre style="font-size:10px;font-family:var(--mono);background:var(--bg3);padding:8px;max-height:150px;overflow-y:auto;white-space:pre-wrap;color:var(--text2)">${(rawText||'').replace(/</g,'&lt;').slice(0,2000)}</pre></details>`:''}
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <i class="ti ti-receipt" style="color:var(--blue)"></i>Dane z faktury
        <span style="font-size:11px;font-weight:400;color:var(--text2)">â€” zielone = rozpoznane automatycznie</span>
      </div>
      <div class="fg" style="gap:10px">
        <div class="f"><label>Typ zdarzenia</label>
          <select id="fakf-typ" class="fi">
            <option value="ZAKUP" ${(d.typZdarzenia||'ZAKUP')==='ZAKUP'?'selected':''}>đźź˘ ZAKUP pojazdu</option>
            <option value="SPRZEDAĹ»" ${d.typZdarzenia==='SPRZEDAĹ»'?'selected':''}>đź”´ SPRZEDAĹ» / zbycie pojazdu</option>
            <option value="LEASING">đź“‹ Umowa leasingowa</option>
            <option value="INNE">đź“Ś Inne zdarzenie</option>
          </select>
        </div>
        ${fld('nrRej','đź”‘ Nr rejestracyjny pojazdu',d.nrRej,'np. WA4789F','wymagane')}
        ${fld('data','đź“… Data wystawienia faktury',d.data,'DD.MM.RRRR','')}
        ${fld('dataSprzedazy','đź“… Data sprzedaĹĽy / nabycia',d.dataSprzedazy||d.data,'DD.MM.RRRR','dla DT-1')}
        ${fld('nrFaktury','đź”˘ Nr faktury / umowy',d.nrFaktury,'np. FV/12/2026','')}
        ${fld('sprzedawca','đźŹ˘ Sprzedawca / wystawca',d.sprzedawca,'nazwa firmy','')}
        ${fld('nipSprzedawcy','NIP sprzedawcy',d.nipSprzedawcy,'10 cyfr','')}
        ${fld('cenaNetto','đź’° Cena netto (zĹ‚)',d.cenaNetto,'np. 150000.00','')}
        ${fld('cenaBrutto','đź’ł Cena brutto (zĹ‚)',d.cenaBrutto,'np. 184500.00','')}
        <div class="f full"><label>đź“ť Uwagi</label><input id="fakf-uwagi" class="fi" placeholder="Opcjonalne uwagi..."></div>
      </div>
    </div>
    <button class="btn btn-blue" style="width:100%;justify-content:center;padding:12px;font-size:14px" onclick="fakSubmit()">
      <i class="ti ti-check"></i>Zapisz zdarzenie i aktualizuj pojazd w bazie
    </button>`;
}

function fakSubmit() {
  const g=id=>document.getElementById('fakf-'+id)?.value?.trim()||'';
  const nrRej=g('nrRej').toUpperCase().replace(/\s/g,'');
  if(!nrRej){toast('âš  Wpisz numer rejestracyjny');return;}
  const ev={
    nrRej, typ:document.getElementById('fakf-typ').value,
    data:g('data'), dataSprzedazy:g('dataSprzedazy'),
    nrFaktury:g('nrFaktury'), sprzedawca:g('sprzedawca'),
    nipSprzedawcy:g('nipSprzedawcy'), cenaNetto:g('cenaNetto'),
    cenaBrutto:g('cenaBrutto'), uwagi:g('uwagi'),
    ts:new Date().toLocaleString('pl-PL')
  };
  fakHistory.unshift(ev);
  renderFakHistory();

  // Aktualizuj pojazd w bazie
  const v=vehs.find(x=>x.nrRej.toUpperCase().replace(/\s/g,'')=== nrRej);
  if(v){
    if(ev.typ==='ZAKUP'&&ev.dataSprzedazy){
      v.dataNabycia=ev.dataSprzedazy;
      // Przelicz miesiÄ…ce podatkowe
      const parts=ev.dataSprzedazy.split('.');
      if(parts.length===3){
        const d=new Date(parseInt(parts[2]),parseInt(parts[1])-1,parseInt(parts[0]));
        const yr=parseInt(document.getElementById('taxYear').value)||new Date().getFullYear();
        const startMonth=d.getMonth()+2; // od nastÄ™pnego miesiÄ…ca
        v.miesiacePodatku=Math.max(1,Math.min(12,13-startMonth));
      }
    }
    if(ev.typ==='SPRZEDAĹ»'&&ev.dataSprzedazy){
      v.dataZbycia=ev.dataSprzedazy;
      const parts=ev.dataSprzedazy.split('.');
      if(parts.length===3){
        const d=new Date(parseInt(parts[2]),parseInt(parts[1])-1,parseInt(parts[0]));
        v.miesiacePodatku=Math.max(1,d.getMonth()+1);
      }
    }
    toast(`âś“ Zdarzenie zapisane dla ${nrRej} â€” miesiÄ…ce: ${v.miesiacePodatku}`);
    renderVeh(); updateCounters();
  } else {
    toast(`âš  Pojazd ${nrRej} nie znaleziony w bazie â€” zdarzenie zapisane tylko w historii`);
  }
  document.getElementById('fak-form').classList.add('hidden');
}

function renderFakHistory() {
  const el=document.getElementById('fak-history-list');
  if(!el)return;
  const q=(document.getElementById('fak-search-veh')?.value||'').toLowerCase();
  const list=fakHistory.filter(h=>!q||h.nrRej.toLowerCase().includes(q));
  if(!list.length){el.innerHTML='<span style="color:var(--text3)">Brak historii</span>';return;}
  el.innerHTML=list.map(h=>`<div style="padding:8px 0;border-bottom:0.5px solid var(--border);font-size:12px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
      <span class="pill ${h.typ==='ZAKUP'?'pill-green':h.typ==='SPRZEDAĹ»'?'pill-red':'pill-amber'}" style="font-size:10px">${h.typ}</span>
      <strong>${h.nrRej}</strong>
      <span style="color:var(--text3);font-size:10px;margin-left:auto">${h.data||h.ts}</span>
    </div>
    <div style="color:var(--text2)">${h.sprzedawca||'â€”'} ${h.cenaBrutto?'Â· '+h.cenaBrutto+' zĹ‚':''}</div>
    ${h.nrFaktury?`<div style="font-family:var(--mono);font-size:10px;color:var(--text3)">${h.nrFaktury}</div>`:''}
  </div>`).join('');
}

// ==================== PDF EXPORT ====================
function refreshPdfPreview() {
  showPage('formularze');
  renderFormularze();
  document.getElementById('pdf-preview').innerHTML=`<div style="padding:1rem;font-size:13px;color:var(--text2);text-align:center">
    <i class="ti ti-check" style="color:var(--green);font-size:20px;display:block;margin-bottom:6px"></i>
    Formularze gotowe â€” przejdĹş do zakĹ‚adki <strong>DT-1 / DT-1/A</strong> aby zobaczyÄ‡ peĹ‚ny podglÄ…d.<br>
    <button class="btn btn-gray" style="margin-top:8px" onclick="showPage('formularze')"><i class="ti ti-eye"></i>OtwĂłrz podglÄ…d formularzy</button>
  </div>`;
  showPage('pdfexport');
  updatePdfSummary();
}

function updatePdfSummary() {
  const selT=getSelTax();
  const taxable=selT.filter(v=>v.cat);
  const total=totalTax();
  const attCount=Math.ceil(taxable.length/3)||0;
  const el1=document.getElementById('pdf-cnt-v');if(el1)el1.textContent=selT.length;
  const el2=document.getElementById('pdf-cnt-att');if(el2)el2.textContent=attCount;
  const el3=document.getElementById('pdf-cnt-total');if(el3)el3.textContent=1+attCount;
  const el4=document.getElementById('pdf-cnt-tax');if(el4)el4.textContent=fmt2(total)+' zĹ‚';
  const el5=document.getElementById('pdf-veh-count');if(el5)el5.textContent=selT.length;
}

async function generatePDF() {
  const selT=getSelTax().filter(v=>v.cat);
  if(selT.length===0){toast('âš  Zaznacz pojazdy w zakĹ‚adce Pojazdy');return;}

  toast('âŹł GenerujÄ™ PDF â€” moĹĽe potrwaÄ‡ kilkanaĹ›cie sekund...');

  // Upewnij siÄ™ ĹĽe formularze sÄ… wygenerowane
  renderFormularze();
  await new Promise(r=>setTimeout(r,500));

  const content=document.getElementById('pdf-content')?.value||'all';
  const fmt=document.getElementById('pdf-format')?.value||'a4';
  const orient=document.getElementById('pdf-orient')?.value||'portrait';
  const scale=parseFloat(document.getElementById('pdf-scale')?.value||'0.9');

  try {
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:orient,unit:'mm',format:fmt});
    const pW=orient==='portrait'?(fmt==='a4'?210:297):(fmt==='a4'?297:420);
    const pH=orient==='portrait'?(fmt==='a4'?297:420):(fmt==='a4'?210:297);

    // Zbierz elementy form-page
    const formPages=document.querySelectorAll('#forms-container .form-page');
    if(!formPages.length){toast('âš  Brak formularzy do eksportu');return;}

    let pageIdx=0;
    for(const fp of formPages){
      if(content==='dt1only'&&fp.closest('#forms-container')&&pageIdx>0)break;
      if(content==='dt1aonly'&&pageIdx===0){pageIdx++;continue;}

      const canvas=await html2canvas(fp,{
        scale:2,useCORS:true,allowTaint:true,
        backgroundColor:'#ffffff',
        logging:false
      });
      const imgData=canvas.toDataURL('image/jpeg',0.92);
      const cW=canvas.width/2; const cH=canvas.height/2;
      const ratio=Math.min((pW-10)/cW,(pH-10)/cH)*scale;
      const iW=cW*ratio; const iH=cH*ratio;
      const xOff=(pW-iW)/2; const yOff=5;

      if(pageIdx>0) pdf.addPage(fmt,orient);
      pdf.addImage(imgData,'JPEG',xOff,yOff,iW,iH);
      pageIdx++;
    }

    const yr=document.getElementById('taxYear').value;
    const nip=tp('tp-nip')||'podatnik';
    pdf.save(`DT1_${nip}_${yr}.pdf`);
    toast(`âś“ PDF pobrany â€” ${pageIdx} stron(y)`);

  } catch(err) {
    console.error(err);
    toast('âš  BĹ‚Ä…d generowania PDF: '+err.message+' â€” sprĂłbuj Drukuj przez przeglÄ…darkÄ™');
  }
}

// ==================== IMPORT / EKSPORT ====================

// --- Import Excel ---
function impXlDrop(e) {
  e.preventDefault();
  document.getElementById('imp-xl-drop').style.borderColor='var(--border2)';
  if(e.dataTransfer.files[0]) impXlProcess(e.dataTransfer.files[0]);
}
function impXlHandle(inp) { if(inp.files[0]) impXlProcess(inp.files[0]); }

function impXlProcess(f) {
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){document.getElementById('imp-xl-result').innerHTML='<div class="ebox"><i class="ti ti-alert-circle"></i>Plik pusty</div>';return;}
      const headers=Object.keys(rows[0]);
      // Mapowanie kolumn
      const find=(names)=>headers.find(h=>names.some(n=>h.toLowerCase().replace(/[Ä…Ä‡Ä™Ĺ‚Ĺ„ĂłĹ›ĹşĹĽ]/g,c=>({Ä…:'a',Ä‡:'c',Ä™:'e',Ĺ‚:'l',Ĺ„:'n',Ăł:'o',Ĺ›:'s',Ĺş:'z',ĹĽ:'z'})[c]||c).replace(/\s/g,'').includes(n)))||null;
      const colNrRej=find(['nrrej','rejestr','tablica','nr_rej']);
      const colMarka=find(['marka','make','producent']);
      const colModel=find(['model']);
      const colRok=find(['rokprod','rokprodu','rok_prod','rok']);
      const colTyp=find(['typ','rodzaj','type']);
      const colDmc=find(['dmc','masacalk','dopuszczalna']);
      const colEuro=find(['euro','emisja']);
      const colVin=find(['vin','podwozia','nadwozia']);
      const colStatus=find(['statuswlasn','status','wlasnosc']);
      const colWl=find(['wlasciciel','owner','posiadacz']);

      const imported=[];
      rows.forEach((row,i)=>{
        const nrRej=String(row[colNrRej]||'').trim();
        const dmc=parseFloat(String(row[colDmc]||'0').replace(',','.'))||0;
        if(!nrRej&&dmc<=0)return;
        if(dmc>0&&dmc<=3500)return; // pomiĹ„ pojazdy <3.5t
        imported.push({
          id:vehs.length+imported.length,
          nrRej:nrRej.toUpperCase(),
          marka:String(row[colMarka]||'').trim(),
          model:String(row[colModel]||'').trim(),
          rok:parseInt(row[colRok])||0,
          typ:String(row[colTyp]||'CiÄ™ĹĽarowy').trim(),
          dmc,
          euro:String(row[colEuro]||'').trim(),
          vin:String(row[colVin]||'').trim(),
          status:String(row[colStatus]||'WĹ‚asny').trim(),
          wlasciciel:String(row[colWl]||'mToilet').trim(),
          osie:dmc>=12000?3:2,zawieszenie:'pneumatyczne',dmcZespolu:0,miesiacePodatku:12
        });
      });

      // PokaĹĽ podglÄ…d
      showImpPreview(imported,'xl');
      document.getElementById('imp-xl-result').innerHTML=`<div class="gbox"><i class="ti ti-circle-check"></i>Wczytano ${imported.length} pojazdĂłw z ${rows.length} wierszy. SprawdĹş podglÄ…d poniĹĽej.</div>`;
    } catch(err) {
      document.getElementById('imp-xl-result').innerHTML=`<div class="ebox"><i class="ti ti-alert-circle"></i>BĹ‚Ä…d odczytu: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(f);
}

// --- Import CSV ---
function impCsvHandle(inp) {
  if(!inp.files[0])return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const lines=e.target.result.split('\n').filter(Boolean);
      if(lines.length<2){document.getElementById('imp-csv-result').innerHTML='<div class="ebox">Plik pusty</div>';return;}
      const headers=lines[0].split(/[,;]/).map(h=>h.trim().toLowerCase());
      const imported=[];
      lines.slice(1).forEach((line,i)=>{
        const vals=line.split(/[,;]/).map(v=>v.trim().replace(/^"|"$/g,''));
        const row={};
        headers.forEach((h,j)=>row[h]=vals[j]||'');
        const dmc=parseFloat(row['dmc']||row['masa']||'0')||0;
        if(dmc>3500||row['nrrej']||row['nr rej']) {
          imported.push({
            id:vehs.length+imported.length,
            nrRej:(row['nrrej']||row['nr rej']||'').toUpperCase(),
            marka:row['marka']||'',model:row['model']||'',
            rok:parseInt(row['rok'])||0,typ:row['typ']||'CiÄ™ĹĽarowy',
            dmc,euro:row['euro']||'',vin:row['vin']||'',
            status:row['status']||'WĹ‚asny',wlasciciel:row['wlasciciel']||'mToilet',
            osie:dmc>=12000?3:2,zawieszenie:'pneumatyczne',dmcZespolu:0,miesiacePodatku:12
          });
        }
      });
      showImpPreview(imported,'csv');
      document.getElementById('imp-csv-result').innerHTML=`<div class="gbox"><i class="ti ti-circle-check"></i>Wczytano ${imported.length} pojazdĂłw.</div>`;
    } catch(err) {
      document.getElementById('imp-csv-result').innerHTML=`<div class="ebox">BĹ‚Ä…d: ${err.message}</div>`;
    }
  };
  reader.readAsText(inp.files[0],'UTF-8');
}

// --- Import JSON ---
function impJsonHandle(inp) {
  if(!inp.files[0])return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const state=JSON.parse(e.target.result);
      if(state.vehs&&Array.isArray(state.vehs)){
        const count=state.vehs.length;
        // PrzywrĂłÄ‡ pojazdy
        vehs.splice(0,vehs.length,...state.vehs);
        selected.clear();
        if(state.selected) state.selected.forEach(id=>selected.add(id));
        if(state.taxpayer) Object.entries(state.taxpayer).forEach(([k,v])=>taxpayer[k]=v);
        if(state.fakHistory) fakHistory.splice(0,fakHistory.length,...state.fakHistory);
        if(state.decReason) decReason=state.decReason;
        // OdĹ›wieĹĽ UI
        renderVeh(); updateCounters(); renderFakHistory();
        // Wstaw dane podatnika
        Object.entries(taxpayer).forEach(([k,v])=>{const el=document.getElementById('tp-'+k.replace(/([A-Z])/g,'-$1').toLowerCase());if(el)el.value=v;});
        document.getElementById('imp-json-result').innerHTML=`<div class="gbox"><i class="ti ti-circle-check"></i>Wczytano ${count} pojazdĂłw + dane sesji.</div>`;
        toast(`âś“ Backup wczytany â€” ${count} pojazdĂłw, ${state.selected?.length||0} zaznaczonych`);
      }else{throw new Error('NieprawidĹ‚owy format JSON');}
    } catch(err) {
      document.getElementById('imp-json-result').innerHTML=`<div class="ebox">BĹ‚Ä…d: ${err.message}</div>`;
    }
  };
  reader.readAsText(inp.files[0],'UTF-8');
}

// --- PodglÄ…d importu ---
let pendingImport=[];
function showImpPreview(rows,source) {
  pendingImport=rows;
  const el=document.getElementById('imp-preview');
  const body=document.getElementById('imp-preview-body');
  el.classList.remove('hidden');
  const sample=rows.slice(0,20);
  body.innerHTML=`<div class="tbl-wrap" style="margin-bottom:12px"><table>
    <thead><tr><th>Nr rej.</th><th>Marka</th><th>Model</th><th>Rok</th><th>Typ</th><th>DMC (kg)</th><th>Status</th><th>EURO</th></tr></thead>
    <tbody>${sample.map(v=>`<tr>
      <td><strong style="font-family:var(--mono)">${v.nrRej||'â€”'}</strong></td>
      <td>${v.marka}</td><td>${v.model}</td><td>${v.rok||'â€”'}</td>
      <td><span class="pill pill-gray">${v.typ}</span></td>
      <td style="font-family:var(--mono)">${v.dmc.toLocaleString('pl-PL')}</td>
      <td><span class="pill ${STAT_LABELS[v.status]||'pill-gray'}">${v.status}</span></td>
      <td style="font-size:11px">${v.euro||'â€”'}</td>
    </tr>`).join('')}
    ${rows.length>20?`<tr><td colspan="8" style="text-align:center;color:var(--text3);font-size:12px">...i ${rows.length-20} wiÄ™cej pojazdĂłw</td></tr>`:''}
    </tbody></table></div>
  <div style="display:flex;gap:10px">
    <button class="btn btn-gray" onclick="pendingImport=[];document.getElementById('imp-preview').classList.add('hidden')"><i class="ti ti-x"></i>Anuluj</button>
    <button class="btn btn-amber" onclick="impMerge()"><i class="ti ti-git-merge"></i>Scal z bazÄ… (dodaj nowe, zachowaj istniejÄ…ce)</button>
    <button class="btn btn-red" onclick="impReplace()"><i class="ti ti-replace"></i>ZastÄ…p caĹ‚Ä… bazÄ™ (${rows.length} poj.)</button>
  </div>`;
  el.scrollIntoView({behavior:'smooth'});
}

function impMerge() {
  let added=0;
  pendingImport.forEach(nv=>{
    const exists=vehs.find(v=>v.nrRej===nv.nrRej);
    if(!exists){vehs.push({...nv,id:vehs.length});added++;}
  });
  document.getElementById('imp-preview').classList.add('hidden');
  renderVeh();updateCounters();
  toast(`âś“ Scalono â€” dodano ${added} nowych pojazdĂłw`);
}

function impReplace() {
  vehs.splice(0,vehs.length,...pendingImport.map((v,i)=>({...v,id:i})));
  selected.clear();
  document.getElementById('imp-preview').classList.add('hidden');
  renderVeh();updateCounters();
  toast(`âś“ ZastÄ…piono bazÄ™ â€” ${vehs.length} pojazdĂłw`);
}

// --- Eksport Excel ---
function expXlAll() { expXlExport(vehs,'flota_cala'); }
function expXlSel() {
  const sel=getSel();
  if(!sel.length){toast('âš  Brak zaznaczonych pojazdĂłw');return;}
  expXlExport(sel,'flota_zaznaczone');
}

function expXlExport(list,fname) {
  const taxes=list.map(v=>({...v,...calcTax(v)}));
  const hdrs=['Nr rej.','Marka','Model','Rok','Typ','DMC (kg)','DMC zesp. (kg)','EURO','VIN','Status','WĹ‚aĹ›ciciel','Osie','Zawieszenie','Mies. pod.','Kategoria DT-1','Stawka roczna (zĹ‚)','Podatek (zĹ‚)','I rata (zĹ‚)','II rata (zĹ‚)','Â§2 (tak/nie)'];
  const rows=taxes.map(v=>{
    const r1=Math.round((v.amount||0)/2),r2=Math.round(v.amount||0)-r1;
    return [v.nrRej,v.marka,v.model,v.rok,v.typ,v.dmc,v.dmcZespolu||0,v.euro||'',v.vin||'',v.status,v.wlasciciel,v.osie,v.zawieszenie,v.miesiacePodatku||12,v.cat||'',v.rate||0,Math.round((v.amount||0)*100)/100,r1,r2,(parseInt(v.rok)||0)>=2024?'TAK':'NIE'];
  });
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  ws['!cols']=hdrs.map((_,i)=>({wch:[12,10,18,6,12,10,12,10,20,10,14,6,14,8,12,14,12,12,12,8][i]||12}));
  XLSX.utils.book_append_sheet(wb,ws,'Flota');
  XLSX.writeFile(wb,fname+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast(`âś“ Excel pobrany â€” ${list.length} pojazdĂłw`);
}

// --- Eksport CSV ---
function expCsv() {
  const taxes=vehs.map(v=>({...v,...calcTax(v)}));
  const hdrs=['nrRej','marka','model','rok','typ','dmc','dmcZespolu','euro','vin','status','wlasciciel','osie','zawieszenie','miesiacePodatku','cat','rate','amount'];
  const rows=[hdrs.join(';'),...taxes.map(v=>hdrs.map(k=>String(v[k]||'').replace(/;/g,',')).join(';'))];
  const blob=new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='flota_dt1_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(a.href);
  toast(`âś“ CSV pobrany â€” ${vehs.length} pojazdĂłw`);
}

// --- Eksport JSON backup ---
function expJson() {
  const tpData={};
  ['nip','regon','nazwa','ulica','dom','lokal','kod','miasto','woj','organ','imie','nazwisko','cel'].forEach(k=>{
    const el=document.getElementById('tp-'+k);
    if(el)tpData[k]=el.value;
  });
  const state={
    version:'1.0',ts:new Date().toISOString(),
    vehs:vehs,selected:[...selected],
    taxpayer:tpData,decReason,
    fakHistory:fakHistory,
    taxYear:document.getElementById('taxYear')?.value
  };
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='backup_dt1_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();URL.revokeObjectURL(a.href);
  toast(`âś“ Backup zapisany â€” ${vehs.length} pojazdĂłw, ${selected.size} zaznaczonych`);
}

// ==================== LOGIN SYSTEM ====================
const DEFAULT_USERS = [{id:1,name:'Administrator',email:'adamus1000@gmail.com',passwordHash:btoa('asdasd'),role:'admin',tel:'',active:true},{id:2,name:'Kierownik Floty',email:'kierownik@mtoilet.pl',passwordHash:btoa('kierownik123'),role:'kierownik',tel:'',active:true}];
const ROLE_LABELS = {admin:'Administrator',kierownik:'Kierownik',ksiegowy:'KsiÄ™gowy',mechanik:'Mechanik'};
const ROLE_COLORS = {admin:'pill-red',kierownik:'pill-blue',ksiegowy:'pill-green',mechanik:'pill-amber'};
const ROLE_TABS = {
  admin:['dash','pojazdy','kalkulator','formularze','pd','walidacja','raporty','ocr','faktury','pdfexport','impexp','karty','uzytkownicy'],
  kierownik:['dash','pojazdy','kalkulator','formularze','raporty','pdfexport','ocr','faktury','karty'],
  ksiegowy:['dash','kalkulator','formularze','pd','raporty','pdfexport','impexp'],
  mechanik:['dash','pojazdy','ocr','faktury']
};
let users = JSON.parse(localStorage.getItem('dt1_users')||JSON.stringify(DEFAULT_USERS));
let currentUser = null;
let editUserId = null;

function saveUsers(){localStorage.setItem('dt1_users',JSON.stringify(users));}

async function doLogin(){
  const email=(document.getElementById('login-email')?.value||'').trim().toLowerCase();
  const pass=document.getElementById('login-pass')?.value||'';
  const errEl=document.getElementById('login-err');

  if(!email||!pass){
    showLoginErr('Wpisz e-mail i hasĹ‚o');
    return;
  }

  const u=users.find(x=>x.email.toLowerCase()===email&&x.passwordHash===btoa(pass)&&x.active);

  if(!u){
    showLoginErr('BĹ‚Ä™dny e-mail lub hasĹ‚o');
    return;
  }

  if(window.TaxOrderAuth && typeof window.TaxOrderAuth.login === 'function'){
    const authResult = await window.TaxOrderAuth.login(email, pass);

    if(!authResult.ok){
      showLoginErr(
        'BĹ‚Ä…d logowania Supabase: ' +
        (authResult.error?.message || 'brak sesji')
      );
      return;
    }
  }

  currentUser=u;

  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('user-avatar').textContent=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('user-name').textContent=u.name;
  document.getElementById('user-role-lbl').textContent=ROLE_LABELS[u.role]||u.role;

  applyRoleAccess(u.role);
  sessionStorage.setItem('dt1_user_email',u.email);

  if(typeof loadCompanyState==='function'){
    loadCompanyState(currentCompanyId);
    updateCompanyUI();
  }

  if(window.TaxOrderFleetCloud && typeof window.TaxOrderFleetCloud.loadVehicles === 'function'){
    await window.TaxOrderFleetCloud.loadVehicles();

    if(typeof refreshAll==='function') refreshAll();

    console.log('[FleetCloud] Automatycznie zaladowano pojazdy po zalogowaniu Supabase Auth');
  }

  renderDash();
  renderVeh();
  updateCounters();
}

function showLoginErr(msg){
  const el=document.getElementById('login-err');
  if(el){el.style.display='flex';el.innerHTML=`<i class="ti ti-alert-circle"></i>${msg}`;}
}

function doLogout(){
  currentUser=null;
  sessionStorage.removeItem('dt1_user_email');
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-pass').value='';
  document.getElementById('login-err').style.display='none';
}

function applyRoleAccess(role){
  const allowed=ROLE_TABS[role]||ROLE_TABS.mechanik;
  document.querySelectorAll('.tnb').forEach(btn=>{
    const id=btn.id.replace('tnb-','');
    btn.style.display=(role==='admin'||allowed.includes(id))?'':'none';
  });
}

// --- Users CRUD ---
function renderUsers(){
  const tbody=document.getElementById('users-tbody');
  if(!tbody)return;
  tbody.innerHTML=users.map(u=>`<tr>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:30px;height:30px;border-radius:50%;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
        <div><div style="font-weight:500">${u.name}</div>${u.tel?`<div style="font-size:11px;color:var(--text3)">${u.tel}</div>`:''}</div>
      </div>
    </td>
    <td style="font-family:var(--mono);font-size:12px">${u.email}</td>
    <td><span class="pill ${ROLE_COLORS[u.role]||'pill-gray'}">${ROLE_LABELS[u.role]||u.role}</span></td>
    <td style="font-size:11px;color:var(--text2)">${(ROLE_TABS[u.role]||[]).slice(0,4).join(', ')}${(ROLE_TABS[u.role]||[]).length>4?'...':''}</td>
    <td><span class="pill ${u.active?'pill-green':'pill-red'}">${u.active?'Aktywny':'Nieaktywny'}</span></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="tbtn" onclick="openUserModal(${u.id})"><i class="ti ti-edit"></i>Edytuj</button>
        ${u.id!==1?`<button class="tbtn" onclick="toggleUser(${u.id})" style="${u.active?'color:var(--red)':'color:var(--green)'}"><i class="ti ti-${u.active?'user-off':'user-check'}"></i>${u.active?'Blokuj':'Aktywuj'}</button>`:''}
        ${currentUser?.role==='admin'&&u.id!==currentUser.id&&u.id!==1?`<button class="tbtn" onclick="deleteUser(${u.id})" style="color:var(--red)"><i class="ti ti-trash"></i></button>`:''}
      </div>
    </td>
  </tr>`).join('');
}

function openUserModal(id){
  editUserId=id||null;
  const u=id?users.find(x=>x.id===id):null;
  document.getElementById('um-title').textContent=u?'Edytuj uĹĽytkownika':'Dodaj uĹĽytkownika';
  document.getElementById('um-name').value=u?.name||'';
  document.getElementById('um-email').value=u?.email||'';
  document.getElementById('um-pass').value='';
  document.getElementById('um-pass').placeholder=u?'Zostaw puste = bez zmiany hasĹ‚a':'Min. 6 znakĂłw';
  document.getElementById('um-role').value=u?.role||'mechanik';
  document.getElementById('um-tel').value=u?.tel||'';
  document.getElementById('user-modal').classList.remove('hidden');
}

function saveUser(){
  const name=document.getElementById('um-name').value.trim();
  const email=document.getElementById('um-email').value.trim().toLowerCase();
  const pass=document.getElementById('um-pass').value;
  const role=document.getElementById('um-role').value;
  const tel=document.getElementById('um-tel').value.trim();
  if(!name||!email){toast('âš  Wpisz imiÄ™ i e-mail');return;}
  if(!editUserId&&pass.length<6){toast('âš  HasĹ‚o min. 6 znakĂłw');return;}
  if(editUserId){
    const u=users.find(x=>x.id===editUserId);
    if(u){u.name=name;u.email=email;u.role=role;u.tel=tel;if(pass.length>=6)u.passwordHash=btoa(pass);}
  }else{
    if(users.find(x=>x.email===email)){toast('âš  E-mail juĹĽ istnieje');return;}
    users.push({id:Date.now(),name,email,passwordHash:btoa(pass),role,tel,active:true});
  }
  saveUsers();
  document.getElementById('user-modal').classList.add('hidden');
  renderUsers();
  toast(`âś“ ${editUserId?'Zaktualizowano':'Dodano'}: ${name}`);
  editUserId=null;
}

function toggleUser(id){
  const u=users.find(x=>x.id===id);
  if(u){u.active=!u.active;saveUsers();renderUsers();toast(`${u.active?'âś“ Aktywowano':'âš  Zablokowano'}: ${u.name}`);}
}
function deleteUser(id){
  if(!confirm('UsunÄ…Ä‡ uĹĽytkownika?'))return;
  users=users.filter(x=>x.id!==id);saveUsers();renderUsers();toast('âś“ UĹĽytkownik usuniÄ™ty');
}

// ==================== KARTY FLOTOWE ====================
let flotCards=JSON.parse(localStorage.getItem('dt1_karty')||'[]');
let editKartaId=null;

function saveKarty(){localStorage.setItem('dt1_karty',JSON.stringify(flotCards));}

function renderKarty(){
  const tbody=document.getElementById('karty-tbody');
  if(!tbody)return;
  const q=(document.getElementById('kf-search')?.value||'').toLowerCase();
  const typ=document.getElementById('kf-typ')?.value||'';
  const list=flotCards.filter(k=>
    (!q||(k.nr||'').toLowerCase().includes(q)||(k.nrRej||'').toLowerCase().includes(q)||(k.dostawca||'').toLowerCase().includes(q))&&
    (!typ||k.typ===typ)
  );
  if(!list.length){tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-credit-card" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak kart flotowych â€” kliknij Dodaj kartÄ™</td></tr>`;updateKartySummary();return;}
  tbody.innerHTML=list.map(k=>`<tr>
    <td style="font-family:var(--mono);font-size:12px;font-weight:600">${maskCard(k.nr)}</td>
    <td>
      <div style="display:flex;align-items:center;gap:6px">
        <span id="pin-${k.id}" style="font-family:var(--mono);letter-spacing:2px">â€˘â€˘â€˘â€˘</span>
        <button class="tbtn" style="padding:3px 8px;font-size:10px" onclick="togglePin('${k.id}','${k.pin}')">PokaĹĽ</button>
      </div>
    </td>
    <td><strong style="font-family:var(--mono)">${k.nrRej||'â€”'}</strong></td>
    <td><span class="pill ${{PALIWOWA:'pill-blue','OPĹATY':'pill-amber',PARKING:'pill-green',INNA:'pill-gray'}[k.typ]||'pill-gray'}">${k.typ}</span></td>
    <td>${k.dostawca||'â€”'}</td>
    <td style="font-family:var(--mono)">${k.limit?k.limit.toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
    <td style="font-size:12px">${k.wazna||'â€”'}</td>
    <td><span class="pill ${{AKTYWNA:'pill-green',ZABLOKOWANA:'pill-red',WYGASĹA:'pill-gray'}[k.status]||'pill-gray'}">${k.status}</span></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="tbtn" onclick="openKartaModal('${k.id}')"><i class="ti ti-edit"></i></button>
        <button class="tbtn" onclick="deleteKarta('${k.id}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>
      </div>
    </td>
  </tr>`).join('');
  updateKartySummary();
}

function maskCard(nr){return (nr||'').replace(/\d(?=\d{4})/g,'â€˘').replace(/(.{4})/g,'$1 ').trim();}

function togglePin(id,pin){
  const el=document.getElementById('pin-'+id);
  if(!el)return;
  if(el.textContent==='â€˘â€˘â€˘â€˘'){el.textContent=pin||'????';el.nextElementSibling.textContent='Ukryj';}
  else{el.textContent='â€˘â€˘â€˘â€˘';el.nextElementSibling.textContent='PokaĹĽ';}
}

function updateKartySummary(){
  const el=document.getElementById('karty-summary');if(!el)return;
  if(!flotCards.length){el.innerHTML='<span style="color:var(--text3)">Brak kart</span>';return;}
  const byTyp={};flotCards.forEach(k=>{if(!byTyp[k.typ])byTyp[k.typ]=0;byTyp[k.typ]++;});
  const aktywne=flotCards.filter(k=>k.status==='AKTYWNA').length;
  el.innerHTML=`<div class="sum-row"><span>Kart Ĺ‚Ä…cznie</span><span class="sum-val">${flotCards.length}</span></div>
    <div class="sum-row"><span>Aktywnych</span><span class="sum-val green">${aktywne}</span></div>
    ${Object.entries(byTyp).map(([t,n])=>`<div class="sum-row"><span>${t}</span><span class="sum-val">${n}</span></div>`).join('')}`;
}

function openKartaModal(id){
  editKartaId=id||null;
  const k=id?flotCards.find(x=>x.id===id):null;
  document.getElementById('km-title').textContent=k?'Edytuj kartÄ™':'Dodaj kartÄ™ flotowÄ…';
  document.getElementById('km-nr').value=k?.nr||'';
  document.getElementById('km-pin').value=k?.pin||'';
  document.getElementById('km-nrrej').value=k?.nrRej||'';
  document.getElementById('km-typ').value=k?.typ||'PALIWOWA';
  document.getElementById('km-dostawca').value=k?.dostawca||'';
  document.getElementById('km-limit').value=k?.limit||'';
  document.getElementById('km-wazna').value=k?.wazna||'';
  document.getElementById('km-status').value=k?.status||'AKTYWNA';
  document.getElementById('km-uwagi').value=k?.uwagi||'';
  // WypeĹ‚nij datalist pojazdĂłw
  const dl=document.getElementById('km-veh-list');
  if(dl) dl.innerHTML=vehs.map(v=>`<option value="${v.nrRej}">${v.nrRej} â€” ${v.marka} ${v.model}</option>`).join('');
  document.getElementById('karta-modal').classList.remove('hidden');
}

function saveKarta(){
  const nr=document.getElementById('km-nr').value.trim();
  const pin=document.getElementById('km-pin').value.trim();
  if(!nr){toast('âš  Wpisz numer karty');return;}
  const data={
    id:editKartaId||('k'+Date.now()),
    nr,pin,nrRej:document.getElementById('km-nrrej').value.trim().toUpperCase(),
    typ:document.getElementById('km-typ').value,
    dostawca:document.getElementById('km-dostawca').value.trim(),
    limit:parseFloat(document.getElementById('km-limit').value)||0,
    wazna:document.getElementById('km-wazna').value.trim(),
    status:document.getElementById('km-status').value,
    uwagi:document.getElementById('km-uwagi').value.trim()
  };
  if(editKartaId){const i=flotCards.findIndex(x=>x.id===editKartaId);if(i>=0)flotCards[i]=data;}
  else flotCards.push(data);
  saveKarty();document.getElementById('karta-modal').classList.add('hidden');
  renderKarty();toast(`âś“ Karta ${nr} zapisana`);editKartaId=null;
}

function deleteKarta(id){
  if(!confirm('UsunÄ…Ä‡ kartÄ™?'))return;
  flotCards=flotCards.filter(x=>x.id!==id);saveKarty();renderKarty();toast('âś“ Karta usuniÄ™ta');
}

function importKarty(inp){
  if(!inp.files[0])return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      let added=0;
      rows.forEach(r=>{
        const nr=String(r['Nr karty']||r['nr karty']||r['number']||'').trim();
        if(!nr)return;
        flotCards.push({
          id:'k'+Date.now()+added,
          nr,pin:String(r['PIN']||r['pin']||'').trim(),
          nrRej:String(r['Nr rej']||r['nr rej']||r['nrRej']||'').trim().toUpperCase(),
          typ:String(r['Typ']||r['typ']||'PALIWOWA').trim().toUpperCase(),
          dostawca:String(r['Dostawca']||r['dostawca']||'').trim(),
          limit:parseFloat(r['Limit']||r['limit']||'0')||0,
          wazna:String(r['WaĹĽna do']||r['wazna']||'').trim(),
          status:String(r['Status']||r['status']||'AKTYWNA').trim().toUpperCase(),
          uwagi:String(r['Uwagi']||r['uwagi']||'').trim()
        });added++;
      });
      saveKarty();renderKarty();toast(`âś“ Zaimportowano ${added} kart`);
    }catch(err){toast('âš  BĹ‚Ä…d importu: '+err.message);}
  };
  reader.readAsArrayBuffer(inp.files[0]);
}

function exportKarty(){
  if(!flotCards.length){toast('âš  Brak kart do eksportu');return;}
  const hdrs=['Nr karty','PIN','Nr rej.','Typ','Dostawca','Limit (zĹ‚)','WaĹĽna do','Status','Uwagi'];
  const rows=flotCards.map(k=>[k.nr,k.pin,k.nrRej,k.typ,k.dostawca,k.limit,k.wazna,k.status,k.uwagi]);
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  ws['!cols']=[{wch:20},{wch:8},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:12},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws,'Karty Flotowe');
  XLSX.writeFile(wb,'karty_flotowe_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast(`âś“ Eksport ${flotCards.length} kart`);
}

// ==================== DOKUMENTY POJAZDĂ“W (Dowody rej.) ====================
let docStore={};  // {nrRej: [{id, name, type, data, uploadedAt}]}
let currentDocNrRej=null;

function getDocIcon(nrRej){
  const docs=docStore[nrRej]||[];
  if(!docs.length) return `<button class="tbtn" style="padding:3px 8px;font-size:10px;color:var(--text3)" title="Dodaj dokument" onclick="event.stopPropagation();triggerDocUpload('${nrRej}')"><i class="ti ti-upload"></i></button>`;
  return `<button class="tbtn" style="padding:3px 8px;font-size:10px;color:var(--blue)" title="${docs.length} dok." onclick="event.stopPropagation();openDocModal('${nrRej}')"><i class="ti ti-file-description"></i> ${docs.length}</button>`;
}

function triggerDocUpload(nrRej){
  currentDocNrRej=nrRej;
  const inp=document.getElementById('doc-file-inp')||createDocInput();
  inp.click();
}

function createDocInput(){
  const inp=document.createElement('input');
  inp.type='file';inp.id='doc-file-inp';inp.accept='image/*,.pdf';inp.style.display='none';
  inp.addEventListener('change',()=>handleDocUpload(inp));
  document.body.appendChild(inp);
  return inp;
}

function handleDocUpload(inp){
  const f=inp.files[0];if(!f||!currentDocNrRej)return;
  if(f.size>5*1024*1024){toast('âš  Plik za duĹĽy â€” maks. 5 MB dla dokumentĂłw');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const doc={id:'doc'+Date.now(),name:f.name,type:f.type,data:e.target.result,uploadedAt:new Date().toLocaleString('pl-PL'),nrRej:currentDocNrRej};
    if(!docStore[currentDocNrRej])docStore[currentDocNrRej]=[];
    docStore[currentDocNrRej].push(doc);
    renderVeh();
    toast(`âś“ Dodano dokument dla ${currentDocNrRej}: ${f.name}`);
    openDocModal(currentDocNrRej);
  };
  reader.readAsDataURL(f);
  inp.value='';
}

function openDocModal(nrRej){
  currentDocNrRej=nrRej;
  const docs=docStore[nrRej]||[];
  const v=vehs.find(x=>x.nrRej===nrRej);
  document.getElementById('doc-modal-title').textContent=`Dokumenty: ${nrRej}`;
  document.getElementById('doc-modal-sub').textContent=v?`${v.marka} ${v.model} Â· ${docs.length} dok.`:`${docs.length} dokumentĂłw`;

  if(!docs.length){
    document.getElementById('doc-modal-body').innerHTML=`<div style="text-align:center;padding:3rem;color:var(--text3)">
      <i class="ti ti-file-off" style="font-size:48px;display:block;margin-bottom:12px"></i>
      <div style="margin-bottom:14px">Brak dokumentĂłw dla ${nrRej}</div>
      <button class="btn btn-blue" onclick="triggerDocUpload('${nrRej}')"><i class="ti ti-upload"></i>Wgraj dowĂłd rejestracyjny</button>
    </div>`;
  }else{
    document.getElementById('doc-modal-body').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        ${docs.map(d=>`<div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
          ${d.type.startsWith('image/')?
            `<img src="${d.data}" style="width:100%;max-height:280px;object-fit:contain;background:#f0f0f0;display:block">`:
            `<div style="background:#f5f5f4;height:200px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">
              <i class="ti ti-file-type-pdf" style="font-size:48px;color:var(--red)"></i>
              <div style="font-size:12px;color:var(--text2)">${d.name}</div>
              <a href="${d.data}" target="_blank" class="btn btn-gray" style="font-size:11px"><i class="ti ti-external-link"></i>OtwĂłrz PDF</a>
            </div>`}
          <div style="padding:10px 12px">
            <div style="font-weight:500;font-size:12px;margin-bottom:2px">${d.name}</div>
            <div style="font-size:11px;color:var(--text3)">${d.uploadedAt}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <a href="${d.data}" download="${d.name}" class="btn btn-gray" style="font-size:11px;flex:1;justify-content:center"><i class="ti ti-download"></i>Pobierz</a>
              <button class="btn btn-gray" style="font-size:11px;color:var(--blue)" onclick="runOcrOnDoc('${d.id}','${nrRej}')"><i class="ti ti-scan"></i>OCR</button>
              <button class="btn btn-gray" style="font-size:11px;color:var(--red)" onclick="deleteDoc('${nrRej}','${d.id}')"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <button class="btn btn-blue" onclick="triggerDocUpload('${nrRej}')"><i class="ti ti-upload"></i>Dodaj kolejny dokument</button>`;
  }
  document.getElementById('doc-modal').classList.remove('hidden');
}

function deleteDoc(nrRej,docId){
  if(!docStore[nrRej])return;
  docStore[nrRej]=docStore[nrRej].filter(d=>d.id!==docId);
  openDocModal(nrRej);renderVeh();toast('âś“ Dokument usuniÄ™ty');
}

async function runOcrOnDoc(docId,nrRej){
  const doc=(docStore[nrRej]||[]).find(d=>d.id===docId);
  if(!doc){toast('âš  Dokument nie znaleziony');return;}
  document.getElementById('doc-modal').classList.add('hidden');
  showPage('ocr');
  // ZaĹ‚aduj dokument do OCR
  ocrBase64=doc.data.split(',')[1];
  ocrMime=doc.type;
  toast('âŹł Uruchamiam OCR na dokumencie '+doc.name+'...');
  await new Promise(r=>setTimeout(r,300));
  document.getElementById('ocr-img').src=doc.data;
  document.getElementById('ocr-img').style.display=doc.type.startsWith('image/')?'block':'none';
  document.getElementById('ocr-preview').classList.remove('hidden');
  document.getElementById('ocr-btn-area').classList.remove('hidden');
  await runOCR();
}

// ==================== HOOK do renderVeh â€” dodaj kolumnÄ™ dokumentĂłw ====================
const _origRenderVeh = renderVeh;
function renderVehWithDocs(){
  // WywoĹ‚aj oryginaĹ‚ (renderuje tbody)
  _origRenderVeh();
  // Dodaj kolumnÄ™ dokumentĂłw do kaĹĽdego wiersza
  const tbody=document.getElementById('veh-tbody');
  if(!tbody)return;
  const rows=tbody.querySelectorAll('tr');
  const filteredVehs=filterVeh();
  rows.forEach((row,i)=>{
    const v=filteredVehs[i];if(!v)return;
    const td=document.createElement('td');
    td.style.textAlign='center';
    td.innerHTML=getDocIcon(v.nrRej);
    row.appendChild(td);
  });
}
// ZastÄ…p renderVeh
window.renderVeh=renderVehWithDocs;


// ==================== FIRMY (Multi-Firma) ====================
let COMPANIES = {
  mtoilet:{id:'mtoilet',shortName:'mToilet',name:'MTOILET SPĂ“ĹKA Z OGRANICZONÄ„ ODPOWIEDZIALNOĹšCIÄ„',nip:'5361938486',regon:'367263453',krs:'0000766937',ulica:'TORUĹSKA',dom:'31',lokal:'',kod:'03-226',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy â€” Dzielnica BiaĹ‚oĹ‚Ä™ka',color:'#185FA5',wlasciciel:'mToilet'},
  gcon:{id:'gcon',shortName:'G-CON',name:'G-CON SPĂ“ĹKA Z OGRANICZONÄ„ ODPOWIEDZIALNOĹšCIÄ„',nip:'5223036167',regon:'362307353',krs:'0000572114',ulica:'EUGENIUSZA BOCHEĹSKIEGO "DUBAĹCA"',dom:'6',lokal:'',kod:'04-478',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy â€” Dzielnica RembertĂłw',color:'#3B6D11',wlasciciel:'GCON'},
  grental:{id:'grental',shortName:'G-Rental',name:'G-RENTAL SPĂ“ĹKA Z OGRANICZONÄ„ ODPOWIEDZIALNOĹšCIÄ„',nip:'9522192210',regon:'381803583',krs:'0000765416',ulica:'EUGENIUSZA BOCHEĹSKIEGO "DUBAĹCA"',dom:'6',lokal:'',kod:'04-478',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy â€” Dzielnica RembertĂłw',color:'#BA7517',wlasciciel:'GRENTAL'},
  kjrsupply:{id:'kjrsupply',shortName:'KJR Supply',name:'KJR SUPPLY SPĂ“ĹKA Z OGRANICZONÄ„ ODPOWIEDZIALNOĹšCIÄ„',nip:'5223116423',regon:'369535413',krs:'0000722764',ulica:'MAGENTA',dom:'142',lokal:'',kod:'04-429',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy â€” Dzielnica Wawer',color:'#7C3AED',wlasciciel:'KJR Supply'},
  nwkinvest:{id:'nwkinvest',shortName:'NWK Invest',name:'NWK INVEST SPĂ“ĹKA Z OGRANICZONÄ„ ODPOWIEDZIALNOĹšCIÄ„',nip:'5361920285',regon:'362208763',krs:'0000573479',ulica:'MACIEJKI',dom:'3',lokal:'',kod:'05-140',miasto:'JACHRANKA',woj:'MAZOWIECKIE',organ:'Burmistrz Gminy Serock',color:'#A32D2D',wlasciciel:'NWK Invest'},
  wolund:{id:'wolund',shortName:'Wolund',name:'WOLUND SYNERGY SPĂ“ĹKA Z OGRANICZONÄ„ ODPOWIEDZIALNOĹšCIÄ„',nip:'5253006751',regon:'',krs:'0001111249',ulica:'ADAMA MICKIEWICZA',dom:'37',lokal:'58',kod:'01-625',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy â€” Dzielnica Ĺ»oliborz',color:'#0891B2',wlasciciel:'Wolund'}
};
let currentCompanyId=localStorage.getItem('dt1_current_company')||'mtoilet';
let companyStates=JSON.parse(localStorage.getItem('dt1_company_states')||'{}');

// Udostďż˝pnienie danych floty dla moduďż˝ďż˝w zewnďż˝trznych, np. migracji Supabase
window.getTaxOrderVehicles = function(){ return vehs || []; };
window.setTaxOrderVehicles = function(list){
  vehs.splice(0, vehs.length, ...(list || []).map((v,i)=>({...v,id:i})));
  selected.clear();
  if (typeof renderVeh === "function") renderVeh();
  if (typeof updateCounters === "function") updateCounters();
  if (typeof renderDash === "function") renderDash();
};
function getCurrentCompany(){return COMPANIES[currentCompanyId];}

function saveCompanyState(){
  const state={vehs:vehs.map(v=>({...v})),selected:[...selected],taxYear:document.getElementById('taxYear')?.value||'2026',taxpayer:{}};
  ['nip','regon','nazwa','ulica','dom','lokal','kod','miasto','woj','organ','imie','nazwisko','cel'].forEach(k=>{const el=document.getElementById('tp-'+k);if(el)state.taxpayer[k]=el.value;});
  companyStates[currentCompanyId]=state;
  localStorage.setItem('dt1_company_states',JSON.stringify(companyStates));
}

function loadCompanyState(companyId){
  const company=COMPANIES[companyId];if(!company)return;
  const state=companyStates[companyId];
  if(state?.vehs?.length){
    vehs.splice(0,vehs.length,...state.vehs.map((v,i)=>({...v,id:i})));
  } else {
    const base=VEHICLES.filter(v=>{
      if(!v.wlasciciel)return companyId==='mtoilet';
      const w=v.wlasciciel.toLowerCase();
      if(companyId==='mtoilet')return w==='mtoilet';
      if(companyId==='gcon')return w==='gcon';
      if(companyId==='grental')return w==='grental'||w==='g-rental';
      if(companyId==='kjrsupply')return w.includes('kjr');
      if(companyId==='nwkinvest')return w.includes('nwk');
      if(companyId==='wolund')return w.includes('wolund');
      return false;
    }).map((v,i)=>({...v,id:i,osie:v.osie||2,zawieszenie:v.zawieszenie||'pneumatyczne',dmcZespolu:v.dmcZespolu||0,miesiacePodatku:v.miesiacePodatku||12}));
    vehs.splice(0,vehs.length,...base);
  }
  selected.clear();
  if(state?.selected)state.selected.forEach(id=>{if(vehs.find(v=>v.id===id))selected.add(id);});
  const tp={
    'tp-nip':state?.taxpayer?.nip||company.nip,
    'tp-regon':state?.taxpayer?.regon||company.regon,
    'tp-nazwa':state?.taxpayer?.nazwa||company.name,
    'tp-ulica':state?.taxpayer?.ulica||company.ulica,
    'tp-dom':state?.taxpayer?.dom||company.dom,
    'tp-lokal':state?.taxpayer?.lokal||company.lokal,
    'tp-kod':state?.taxpayer?.kod||company.kod,
    'tp-miasto':state?.taxpayer?.miasto||company.miasto,
    'tp-woj':state?.taxpayer?.woj||company.woj,
    'tp-organ':state?.taxpayer?.organ||company.organ,
    'tp-imie':state?.taxpayer?.imie||'',
    'tp-nazwisko':state?.taxpayer?.nazwisko||''
  };
  Object.entries(tp).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val||'';});
  const yrEl=document.getElementById('taxYear');if(yrEl)yrEl.value=state?.taxYear||'2026';
}

function switchCompany(companyId){
  if(!COMPANIES[companyId])return;
  saveCompanyState();
  currentCompanyId=companyId;
  localStorage.setItem('dt1_current_company',companyId);
  loadCompanyState(companyId);
  updateCompanyUI();
  refreshAll();
  toast('âś“ PrzeĹ‚Ä…czono: '+COMPANIES[companyId].shortName);
}

function updateCompanyUI(){
  const c=getCurrentCompany();
  const sel=document.getElementById('company-selector');if(sel)sel.value=currentCompanyId;
  const badge=document.getElementById('company-badge');
  if(badge){badge.textContent=c.shortName;badge.style.background=c.color+'22';badge.style.color=c.color;badge.style.border='1px solid '+c.color+'55';}
  document.title='TaxOrder Pro â€” '+c.shortName+' â€” DT-1';
  // Aktualizuj lewÄ… kolumnÄ™ topbar
  const brandEl=document.querySelector('.brand');
  if(brandEl){const span=brandEl.querySelector('span');if(span){span.textContent=c.shortName;span.style.background=c.color+'22';span.style.color=c.color;}}
}

function renderCompanyOverview(){
  const el=document.getElementById('companies-grid');
  if(!el)return;
  el.innerHTML=Object.values(COMPANIES).map(c=>{
    const state=companyStates[c.id];
    const vCount=state?.vehs?.length||0;
    const tax=state?.vehs?.reduce((s,v)=>{const t=calcTax(v);return s+(t.amount||0);},0)||0;
    const isCurrent=c.id===currentCompanyId;
    return `<div onclick="switchCompany('${c.id}')" style="background:${isCurrent?c.color+'11':'var(--bg2)'};border:2px solid ${isCurrent?c.color:'var(--border)'};border-radius:12px;padding:16px;cursor:pointer;transition:all .2s">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:12px;height:12px;border-radius:50%;background:${c.color}"></div>
        <div style="font-weight:600;font-size:14px">${c.shortName}</div>
        ${isCurrent?'<span style="font-size:10px;background:'+c.color+';color:#fff;padding:2px 6px;border-radius:4px;margin-left:auto">AKTYWNA</span>':''}
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:10px">NIP: ${c.nip}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:${c.color}">${vCount||'â€”'}</div>
          <div style="font-size:10px;color:var(--text2)">Pojazdy</div>
        </div>
        <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:13px;font-weight:700;color:var(--green)">${tax>0?Math.round(tax).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</div>
          <div style="font-size:10px;color:var(--text2)">DT-1 2026</div>
        </div>
      </div>
    </div>`;
  }).join('');
}



function renderAllCompaniesSummary() {
  const el = document.getElementById('all-companies-summary');
  if(!el) return;
  let rows = '';
  let grandTotal = 0;
  Object.values(COMPANIES).forEach(c => {
    const state = companyStates[c.id];
    const vList = state?.vehs || [];
    const taxable = vList.filter(v => getCat(v));
    const tax = vList.reduce((s,v) => s + (calcTax(v).amount||0), 0);
    grandTotal += tax;
    const isCur = c.id === currentCompanyId;
    rows += `<tr style="${isCur?'background:'+c.color+'11;font-weight:600':''}">
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color};margin-right:6px"></span>${c.shortName}</td>
      <td style="text-align:center">${vList.length}</td>
      <td style="text-align:center">${taxable.length}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--green)">${tax>0?Math.round(tax).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--blue)">${tax>0?Math.round(tax/2).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--blue)">${tax>0?Math.round(tax-tax/2).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
    </tr>`;
  });
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">Firma</th>
      <th style="text-align:center;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">Pojazdy</th>
      <th style="text-align:center;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">Z kat.</th>
      <th style="text-align:right;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">DT-1 2026</th>
      <th style="text-align:right;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">I rata</th>
      <th style="text-align:right;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">II rata</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="font-weight:700;border-top:2px solid var(--border)">
      <td style="padding:8px 10px">RAZEM GRUPA</td>
      <td></td><td></td>
      <td style="text-align:right;font-family:var(--mono);padding:8px 10px;color:var(--green)">${grandTotal>0?Math.round(grandTotal).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
      <td style="text-align:right;font-family:var(--mono);padding:8px 10px;color:var(--blue)">${grandTotal>0?Math.round(grandTotal/2).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
      <td style="text-align:right;font-family:var(--mono);padding:8px 10px;color:var(--blue)">${grandTotal>0?Math.round(grandTotal-grandTotal/2).toLocaleString('pl-PL')+' zĹ‚':'â€”'}</td>
    </tr></tfoot>
  </table>`;
}



function selectAllTaxable() {
  let count=0;
  vehs.forEach(v=>{const t=calcTax(v);if(t&&t.cat){selected.add(v.id);count++;}});
  renderVeh&&renderVeh();updateCounters&&updateCounters();renderFormularze&&renderFormularze();
  toast('âś… Zaznaczono '+count+' pojazdĂłw opodatkowanych (DT-1)');
}

// ==================== INIT ====================

// ==================== CEPiK INTEGRATION ====================
const CEPIK_TOKEN_URL = 'https://api-cpa.gov.pl/token';
const CEPIK_API_URL   = 'https://api.cepik.gov.pl';

// Mapa prefiksĂłw â†’ wojewĂłdztwa
const WOJ_MAP = {W:'14',WA:'14',WB:'14',WD:'02',WE:'10',WF:'08',WG:'14',
  WK:'12',WL:'06',WN:'28',WO:'16',WP:'30',WR:'18',WS:'24',WT:'26',WZ:'32',
  K:'12',G:'22',P:'30',B:'20',C:'04',D:'02',E:'10',F:'08',L:'06',
  N:'28',O:'16',R:'18',S:'24',T:'26',Z:'32'};

const CEPIK_FIELDS = {
  'marka':'marka','model':'model','numer-vin':'vin',
  'dopuszczalna-masa-calkowita':'dmc',
  'dopuszczalna-masa-calkowita-zespolu-pojazdow':'dmcZespolu',
  'liczba-osi':'osie','rok-produkcji':'rok',
  'data-pierwszej-rejestracji-w-kraju':'dataRejestracji',
  'masa-wlasna':'masaWlasna','rodzaj-paliwa':'paliwo',
  'pojemnosc-skokowa':'pojemnosc','moc-netto':'mocKW',
  'kategoria':'kategoria','rodzaj-zawieszenia-osi-napedzanych':'zawieszenie'
};
const CEPIK_LABELS = {
  marka:'Marka (D.1)',model:'Model (D.2)',vin:'VIN (E)',dmc:'DMC kg (F.1)',
  dmcZespolu:'DMC zesp. kg (F.3)',osie:'Liczba osi (L)',rok:'Rok prod.',
  dataRejestracji:'Data 1. rej. (B)',masaWlasna:'Masa wĹ‚asna kg (G)',
  paliwo:'Paliwo (P.3)',pojemnosc:'PojemnoĹ›Ä‡ cmÂł (P.1)',mocKW:'Moc kW (P.2)',
  kategoria:'Kategoria (J)',zawieszenie:'Zawieszenie (Â§17)'
};

// State
let cepikConsumerKey    = localStorage.getItem('dt1_cepik_key')    || 'P1uJWJ6PQKNAPwd9fdNQeQr0fuIa';
let cepikConsumerSecret = localStorage.getItem('dt1_cepik_secret') || '5NVf8JnqaIBVvIIPznJWJBFD8ZYa';
let cepikToken          = localStorage.getItem('dt1_cepik_token')||'';
let cepikTokenExpires   = parseInt(localStorage.getItem('dt1_cepik_token_exp')||'0');
let cepikProxy          = localStorage.getItem('dt1_cepik_proxy')||'';
let cepikSettings       = JSON.parse(localStorage.getItem('dt1_cepik_settings')||'{"autoEnable":false,"autoHour":6,"notify":"dmc"}');
let cepikCache          = JSON.parse(localStorage.getItem('dt1_cepik_cache')||'{}');
let cepikLastCheck      = localStorage.getItem('dt1_cepik_last_check')||null;
let cepikStats          = {total:0,ok:0,dmc:0,vin:0,notfound:0,err:0};
let batchRunning        = false;
let tokenRefreshTimer   = null;

// --- UI helpers ---
function toggleVis(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const ico = document.getElementById(iconId);
  if(!inp) return;
  inp.type = inp.type==='password' ? 'text' : 'password';
  if(ico) ico.className = inp.type==='password' ? 'ti ti-eye' : 'ti ti-eye-off';
}
function cepikLog(msg, type='info') {
  const el = document.getElementById('cepik-conn-log');
  if(!el) return;
  const color = {info:'var(--text2)',ok:'var(--green)',warn:'var(--amber)',err:'var(--red)'}[type]||'var(--text2)';
  const time = new Date().toLocaleTimeString('pl-PL');
  el.innerHTML = `<span style="color:${color}">[${time}] ${msg}</span>\n` + el.innerHTML;
}
function updateCepikStatus(status) {
  const pill = document.getElementById('cepik-status-pill');
  if(!pill) return;
  const map = {
    none:   {cls:'pill-gray',  txt:'âšŞ Nie skonfigurowano'},
    testing:{cls:'pill-amber', txt:'đź”„ ĹÄ…czenie...'},
    ok:     {cls:'pill-green', txt:'âś… PoĹ‚Ä…czono z CEPiK'},
    cors:   {cls:'pill-amber', txt:'âš  CORS â€” potrzebny proxy'},
    expired:{cls:'pill-amber', txt:'âš  Token wygasĹ‚ â€” odĹ›wieĹĽ'},
    err:    {cls:'pill-red',   txt:'âťŚ BĹ‚Ä…d autoryzacji'},
  };
  const m = map[status]||map.none;
  pill.className = 'pill '+m.cls;
  pill.textContent = m.txt;
}
function showTokenBox(token, expiresIn) {
  const box = document.getElementById('cepik-token-box');
  const disp = document.getElementById('cepik-token-display');
  const exp  = document.getElementById('cepik-token-expires');
  if(box)  box.style.display='block';
  if(disp) disp.value = token;
  if(exp && expiresIn) {
    const mins = Math.floor(expiresIn/60);
    exp.textContent = `(wygasa za ${mins} min, auto-odĹ›wieĹĽanie wĹ‚Ä…czone)`;
  }
  const refreshBtn = document.getElementById('cepik-refresh-btn');
  if(refreshBtn) refreshBtn.style.display='';
}
function copyToken() {
  const t = document.getElementById('cepik-token-display')?.value||'';
  if(t) { navigator.clipboard.writeText(t).then(()=>toast('âś“ Token skopiowany do schowka')); }
}

// --- OAuth2 â€” generowanie tokenu ---
async function cepikGetToken(key, secret) {
  // JeĹ›li jest proxy â€” pobierz token przez proxy (omija CORS)
  if(cepikProxy) {
    const proxyTokenUrl = cepikProxy.replace(/\/$/, '') + '/token';
    cepikLog(`Pobieranie tokenu przez proxy: ${proxyTokenUrl}`, 'info');
    const resp = await fetch(proxyTokenUrl);
    if(!resp.ok) throw new Error('Proxy token HTTP ' + resp.status);
    return resp.json();
  }
  // BezpoĹ›rednie poĹ‚Ä…czenie (moĹĽe byÄ‡ blokowane przez CORS na mobilnych)
  const credentials = btoa(key + ':' + secret);
  cepikLog('GenerujÄ™ token OAuth2 z api-cpa.gov.pl...','info');
  const resp = await fetch(CEPIK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type':  'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if(!resp.ok) {
    const txt = await resp.text().catch(()=>'');
    throw new Error(`Token endpoint: HTTP ${resp.status} â€” ${txt.slice(0,120)}`);
  }
  const data = await resp.json();
  if(!data.access_token) throw new Error('Brak access_token w odpowiedzi: '+JSON.stringify(data).slice(0,100));
  return data;
}

async function cepikConnect() {
  const key    = document.getElementById('cepik-key')?.value?.trim()||'';
  const secret = document.getElementById('cepik-secret')?.value?.trim()||'';
  const proxy  = document.getElementById('cepik-proxy')?.value?.trim()||'';
  if(!key||!secret) { toast('âš  Wpisz Klucz klienta i Klucz sekretny'); return; }

  const btn = document.getElementById('cepik-connect-btn');
  if(btn) { btn.disabled=true; btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>ĹÄ…czenie...'; }
  updateCepikStatus('testing');

  try {
    const data = await cepikGetToken(key, secret);
    const token  = data.access_token;
    const expIn  = data.expires_in || 3600;
    const expAt  = Date.now() + expIn*1000;

    // Zapisz
    cepikConsumerKey    = key;
    cepikConsumerSecret = secret;
    cepikToken          = token;
    cepikTokenExpires   = expAt;
    cepikProxy          = proxy;
    localStorage.setItem('dt1_cepik_key',    key);
    localStorage.setItem('dt1_cepik_secret', secret);
    localStorage.setItem('dt1_cepik_token',  token);
    localStorage.setItem('dt1_cepik_token_exp', String(expAt));
    if(proxy) localStorage.setItem('dt1_cepik_proxy', proxy);

    cepikLog(`âś… Token wygenerowany! Wygasa za ${Math.floor(expIn/60)} min.`,'ok');
    showTokenBox(token, expIn);
    updateCepikStatus('ok');

    // Zaplanuj auto-refresh na 5 min przed wygaĹ›niÄ™ciem
    scheduleTokenRefresh(expIn - 300);

    // Test call do CEPiK
    await cepikTestCall();

  } catch(e) {
    cepikLog('âťŚ BĹ‚Ä…d: '+e.message,'err');
    updateCepikStatus(e.message.includes('401')||e.message.includes('403')?'err':'cors');
    toast('âš  BĹ‚Ä…d poĹ‚Ä…czenia: '+e.message.slice(0,80));
  } finally {
    if(btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-plug"></i>PoĹ‚Ä…cz z CEPiK (generuj token)'; }
  }
}

async function cepikRefreshToken() {
  if(!cepikConsumerKey||!cepikConsumerSecret) { toast('âš  Brak kluczy â€” wpisz Consumer Key i Secret'); return; }
  try {
    cepikLog('OdĹ›wieĹĽam token...','info');
    const data  = await cepikGetToken(cepikConsumerKey, cepikConsumerSecret);
    cepikToken  = data.access_token;
    cepikTokenExpires = Date.now() + (data.expires_in||3600)*1000;
    localStorage.setItem('dt1_cepik_token',  cepikToken);
    localStorage.setItem('dt1_cepik_token_exp', String(cepikTokenExpires));
    showTokenBox(cepikToken, data.expires_in||3600);
    updateCepikStatus('ok');
    scheduleTokenRefresh((data.expires_in||3600) - 300);
    cepikLog('âś… Token odĹ›wieĹĽony','ok');
    toast('âś… Token CEPiK odĹ›wieĹĽony');
  } catch(e) {
    cepikLog('âťŚ Refresh nieudany: '+e.message,'err');
    updateCepikStatus('expired');
  }
}

function scheduleTokenRefresh(inSeconds) {
  if(tokenRefreshTimer) clearTimeout(tokenRefreshTimer);
  if(inSeconds > 0) {
    cepikLog(`âŹ± Auto-refresh tokenu zaplanowany za ${Math.floor(inSeconds/60)} min`,'info');
    tokenRefreshTimer = setTimeout(()=>cepikRefreshToken(), inSeconds*1000);
  }
}

async function cepikTestCall() {
  cepikLog('TestujÄ™ poĹ‚Ä…czenie z api.cepik.gov.pl...','info');
  try {
    // Test z pierwszym pojazdem floty
    const testNr = vehs[0]?.nrRej || 'WA4789F';
    const result = await cepikFetch(testNr, getWoj(testNr));
    const count  = result?.data?.length||0;
    cepikLog(`âś… API CEPiK odpowiada â€” znaleziono ${count} rekordĂłw dla ${testNr}`,'ok');
    toast(`âś… CEPiK dziaĹ‚a! Znaleziono ${count} rekordĂłw dla ${testNr}`);
  } catch(e) {
    if(e.message.includes('CORS')||e.message.includes('Failed to fetch')||e.message.includes('NetworkError')) {
      cepikLog('âš  Problem CORS na api.cepik.gov.pl â€” token OK, ale potrzebny serwer proxy','warn');
      updateCepikStatus('cors');
      document.getElementById('cepik-single-result').innerHTML = showCorsHelp(true);
    } else {
      cepikLog('âš  Test API: '+e.message,'warn');
    }
  }
}

function clearCepikConfig() {
  if(!confirm('UsunÄ…Ä‡ caĹ‚Ä… konfiguracjÄ™ CEPiK (klucze, token, cache)?')) return;
  ['dt1_cepik_key','dt1_cepik_secret','dt1_cepik_token','dt1_cepik_token_exp','dt1_cepik_proxy','dt1_cepik_cache','dt1_cepik_last_check'].forEach(k=>localStorage.removeItem(k));
  cepikConsumerKey='';cepikConsumerSecret='';cepikToken='';cepikProxy='';cepikCache={};
  if(document.getElementById('cepik-key')) document.getElementById('cepik-key').value='';
  if(document.getElementById('cepik-secret')) document.getElementById('cepik-secret').value='';
  const box=document.getElementById('cepik-token-box');if(box)box.style.display='none';
  const rb=document.getElementById('cepik-refresh-btn');if(rb)rb.style.display='none';
  updateCepikStatus('none');
  cepikLog('Konfiguracja wyczyszczona','warn');
  toast('âś“ Konfiguracja CEPiK usuniÄ™ta');
}

// --- Czy token jest waĹĽny? ---
function isCepikTokenValid() {
  return cepikToken && Date.now() < cepikTokenExpires - 60000;
}

// --- Fetch z auto-refresh ---
async function getValidToken() {
  if(isCepikTokenValid()) return cepikToken;
  if(cepikConsumerKey && cepikConsumerSecret) {
    cepikLog('Token wygasĹ‚ â€” automatyczne odĹ›wieĹĽanie...','warn');
    const data = await cepikGetToken(cepikConsumerKey, cepikConsumerSecret);
    cepikToken = data.access_token;
    cepikTokenExpires = Date.now() + (data.expires_in||3600)*1000;
    localStorage.setItem('dt1_cepik_token',  cepikToken);
    localStorage.setItem('dt1_cepik_token_exp', String(cepikTokenExpires));
    scheduleTokenRefresh((data.expires_in||3600) - 300);
    return cepikToken;
  }
  throw new Error('Brak waĹĽnego tokenu i brak kluczy do odĹ›wieĹĽenia');
}

// --- WojewĂłdztwo z nr rej ---
function getWoj(nrRej) {
  const nr = (nrRej||'').toUpperCase().replace(/\s/g,'');
  // SprĂłbuj 2 pierwsze litery
  if(WOJ_MAP[nr.slice(0,2)]) return WOJ_MAP[nr.slice(0,2)];
  // Potem 1 literÄ™
  if(WOJ_MAP[nr[0]]) return WOJ_MAP[nr[0]];
  return document.getElementById('cepik-woj')?.value||'14';
}

// --- GĹ‚Ăłwna funkcja fetch z proxy obsĹ‚ugÄ… ---
async function cepikFetch(nrRej, woj) {
  const nr = (nrRej||'').toUpperCase().replace(/\s/g,'');
  const wojCode = (woj==='auto'||!woj) ? getWoj(nr) : woj;
  // Cache 24h
  const cacheKey = nr+'_'+wojCode;
  const cached   = cepikCache[cacheKey];
  if(cached && Date.now()-cached.ts < 24*60*60*1000) {
    cepikLog(`đź“¦ Cache: ${nr}`,'info');
    return cached.data;
  }

  let data;
  if(cepikProxy) {
    // === PRZEZ PROXY (rozwiÄ…zuje CORS) ===
    const proxyUrl = cepikProxy.replace(/\/$/, '') + `?nr=${encodeURIComponent(nr)}&woj=${wojCode}`;
    cepikLog(`đź“ˇ Proxy: ${nr} â†’ ${proxyUrl.slice(0,60)}...`, 'info');
    const resp = await fetch(proxyUrl);
    if(!resp.ok) throw new Error('Proxy HTTP ' + resp.status);
    data = await resp.json();
  } else {
    // === BEZPOĹšREDNIO (moĹĽe fail CORS w przeglÄ…darce) ===
    const token  = await getValidToken();
    const apiUrl = `${CEPIK_API_URL}/pojazdy?filter%5Bnumer-rejestracyjny%5D=${encodeURIComponent(nr)}&filter%5Bwojewodztwo-rejestracji%5D=${wojCode}&page%5Bnumber%5D=1&page%5Bsize%5D=1`;
    cepikLog(`đź“ˇ Direct: ${nr}`, 'info');
    const resp = await fetch(apiUrl, {
      method:  'GET',
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': 'Bearer '+token },
      mode: 'cors'
    });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    data = await resp.json();
  }

  cepikCache[cacheKey] = {ts:Date.now(), data};
  localStorage.setItem('dt1_cepik_cache', JSON.stringify(cepikCache));
  return data;
}

// --- Parser atrybutĂłw CEPiK ---
function parseCepikAttrs(attrs) {
  const out={};
  Object.entries(CEPIK_FIELDS).forEach(([apiKey,vehKey])=>{
    const val=attrs[apiKey];
    if(val===undefined||val===null||val==='')return;
    if(['dmc','dmcZespolu','masaWlasna','pojemnosc','mocKW'].includes(vehKey))
      out[vehKey]=parseFloat(String(val).replace(/[\s]/g,''))||null;
    else if(['osie','rok'].includes(vehKey))
      out[vehKey]=parseInt(val)||null;
    else if(vehKey==='zawieszenie')
      out[vehKey]=(String(val)||'').toLowerCase().includes('pneumat')?'pneumatyczne':(String(val)||'').toLowerCase().includes('rĂłwnow')?'rĂłwnowaĹĽne':'inne';
    else
      out[vehKey]=String(val).trim();
  });
  return out;
}

function diffCepikVeh(cepikData, veh) {
  return Object.entries(cepikData)
    .filter(([key,cv])=>{
      if(cv===null||cv===undefined)return false;
      const vv=veh[key];
      return String(cv).trim().toLowerCase()!==String(vv||'').trim().toLowerCase()&&String(vv||'').trim()!=='';
    })
    .map(([key,cv])=>({key,label:CEPIK_LABELS[key]||key,cepik:cv,baza:veh[key]}));
}

// --- Sprawdzenie jednego pojazdu ---
async function cepikCheckSingle() {
  const nr  = (document.getElementById('cepik-single-nr')?.value||'').trim().toUpperCase().replace(/\s/g,'');
  const woj = document.getElementById('cepik-single-woj')?.value||'auto';
  if(!nr) { toast('âš  Wpisz numer rejestracyjny'); return; }
  const resEl=document.getElementById('cepik-single-result');
  if(!resEl) return;

  if(!cepikToken && !cepikConsumerKey) { resEl.innerHTML=renderNeedToken(); return; }
  resEl.innerHTML='<div class="ibox"><i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>OdpytujÄ™ CEPiK API...</div>';

  try {
    const json = await cepikFetch(nr, woj==='auto'?getWoj(nr):woj);
    const items = json?.data||[];
    if(!items.length) {
      resEl.innerHTML=`<div class="wbox"><i class="ti ti-alert-triangle"></i>Pojazd <strong>${nr}</strong> nie znaleziony w CEPiK. SprawdĹş nr rejestracyjny i kod wojewĂłdztwa.</div>`;
      return;
    }
    const attrs    = items[0]?.attributes||{};
    const cepikData= parseCepikAttrs(attrs);
    const veh      = vehs.find(v=>v.nrRej.toUpperCase().replace(/\s/g,'')=== nr);
    renderSingleResult(nr, cepikData, veh, resEl);
    cepikLog(`âś… Dane dla ${nr} pobrane z CEPiK`,'ok');
  } catch(e) {
    resEl.innerHTML = renderApiError(e, nr);
    cepikLog('âťŚ '+nr+': '+e.message,'err');
  }
}

function renderSingleResult(nr, cepikData, veh, container) {
  const diffs = veh ? diffCepikVeh(cepikData,veh) : [];
  let html=`<div class="${diffs.length?'wbox':'gbox'}" style="margin-bottom:10px">
    <i class="ti ti-${diffs.length?'alert-triangle':'circle-check'}"></i>
    <div><strong>${nr}</strong> â€” ${diffs.length
      ? `<span style="color:var(--red)">${diffs.length} rozbieĹĽnoĹ›ci z TwojÄ… bazÄ…</span>`
      : 'Dane w peĹ‚ni zgodne z CEPiK âś…'}
    ${!veh?'<span style="color:var(--amber);font-size:11px"> Â· Pojazd nie znaleziony w bazie</span>':''}
    </div></div>`;

  html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:10px">
    <div style="display:grid;grid-template-columns:160px 1fr 1fr;background:var(--bg3);border-bottom:1px solid var(--border)">
      <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">Pole DT-1</div>
      <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--blue)">đź“ˇ CEPiK (oficjalne)</div>
      <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">đź“‹ Twoja baza</div>
    </div>
    ${Object.entries(CEPIK_LABELS).map(([key,label])=>{
      const cv=cepikData[key], bv=veh?veh[key]:'â€”';
      const diff=cv&&bv&&bv!=='â€”'&&String(cv).toLowerCase()!==String(bv||'').toLowerCase();
      return `<div style="display:grid;grid-template-columns:160px 1fr 1fr;border-bottom:0.5px solid var(--border);align-items:center;${diff?'background:var(--amber-light)':''}">
        <div style="padding:7px 12px;font-size:11px;font-weight:500;color:var(--text2)">${label}</div>
        <div style="padding:7px 12px;font-size:12px;font-family:var(--mono);font-weight:${cv?'600':'400'};color:${cv?'var(--text)':'var(--text3)'}">
          ${cv||'â€”'}${diff?'<span class="diff-badge" style="background:var(--amber)">RĂ“Ĺ»NICA</span>':''}
        </div>
        <div style="padding:7px 12px;font-size:12px;font-family:var(--mono);color:var(--text2)">${bv!==undefined&&bv!==''&&bv!==null?bv:'â€”'}</div>
      </div>`;
    }).join('')}
  </div>`;

  if(veh && diffs.length) {
    html+=`<button class="btn btn-blue" onclick="cepikApplyToVeh(${veh.id},${JSON.stringify(cepikData).replace(/"/g,'&quot;')})">
      <i class="ti ti-database-import"></i>Zastosuj dane z CEPiK do pojazdu ${nr} (${diffs.length} pĂłl)
    </button>`;
  }
  container.innerHTML=html;
  updateCepikStatsUI();
}

// --- Weryfikacja wsadowa ---
async function cepikBatchCheck(mode) {
  if(batchRunning){toast('âš  Weryfikacja juĹĽ trwa');return;}
  if(!cepikToken&&!cepikConsumerKey){
    document.getElementById('cepik-batch-results').innerHTML=renderNeedToken();return;
  }

  let batch;
  if(mode==='all')      batch=vehs;
  else if(mode==='sel') batch=getSel();
  else                  batch=vehs.filter(v=>cepikCache[v.nrRej+'_'+getWoj(v.nrRej)]?.diffs?.length);
  if(!batch.length){toast('âš  Brak pojazdĂłw do weryfikacji');return;}

  batchRunning=true;
  cepikStats={total:0,ok:0,dmc:0,vin:0,notfound:0,err:0};
  const prog=document.getElementById('cepik-batch-progress');
  const bar=document.getElementById('cepik-batch-bar');
  const stat=document.getElementById('cepik-batch-status');
  const pct=document.getElementById('cepik-batch-pct');
  const detail=document.getElementById('cepik-batch-detail');
  const res=document.getElementById('cepik-batch-results');
  if(prog) prog.classList.remove('hidden');
  if(res)  res.innerHTML='';

  const results=[];
  for(let i=0;i<batch.length;i++){
    const v=batch[i];
    const pctVal=Math.round((i/batch.length)*100);
    if(bar)    bar.style.width=pctVal+'%';
    if(pct)    pct.textContent=pctVal+'%';
    if(stat)   stat.textContent=`Sprawdzam: ${v.nrRej} (${i+1}/${batch.length})`;
    if(detail) detail.textContent=`${v.marka} ${v.model} â€” ${getWoj(v.nrRej)} woj.`;
    if(i>0)    await new Promise(r=>setTimeout(r,400)); // rate limiting
    try {
      const json =await cepikFetch(v.nrRej, getWoj(v.nrRej));
      const items=json?.data||[];
      cepikStats.total++;
      if(!items.length){cepikStats.notfound++;results.push({v,status:'notfound',diffs:[]});continue;}
      const attrs    =items[0]?.attributes||{};
      const cepikData=parseCepikAttrs(attrs);
      const diffs    =diffCepikVeh(cepikData,v);
      if(!diffs.length)cepikStats.ok++;
      else{
        if(diffs.some(d=>d.key==='dmc'||d.key==='osie'))cepikStats.dmc++;
        if(diffs.some(d=>d.key==='vin'))cepikStats.vin++;
      }
      results.push({v,status:diffs.length?'diff':'ok',diffs,cepikData});
      const ck=v.nrRej+'_'+getWoj(v.nrRej);
      if(cepikCache[ck])cepikCache[ck].diffs=diffs;
    } catch(e) {
      cepikStats.err++;
      results.push({v,status:'err',err:e.message,diffs:[]});
      cepikLog('âťŚ '+v.nrRej+': '+e.message,'err');
    }
  }
  if(bar)  bar.style.width='100%';
  if(pct)  pct.textContent='100%';
  if(stat) stat.textContent='Weryfikacja zakoĹ„czona âś…';
  batchRunning=false;
  cepikLastCheck=new Date().toLocaleString('pl-PL');
  localStorage.setItem('dt1_cepik_last_check',cepikLastCheck);
  localStorage.setItem('dt1_cepik_cache',JSON.stringify(cepikCache));
  updateCepikStatsUI();
  renderBatchResults(results);
  toast(`âś… CEPiK: ${cepikStats.ok} OK Â· ${cepikStats.dmc} rĂłĹĽnic DMC Â· ${cepikStats.notfound} nie znaleziono Â· ${cepikStats.err} bĹ‚Ä™dĂłw`);
}

function renderBatchResults(results) {
  const el=document.getElementById('cepik-batch-results');if(!el)return;
  const diffs   =results.filter(r=>r.status==='diff');
  const errs    =results.filter(r=>r.status==='err');
  const notfound=results.filter(r=>r.status==='notfound');
  const ok      =results.filter(r=>r.status==='ok');
  let html='';
  if(diffs.length){
    html+=`<div style="font-size:13px;font-weight:600;color:var(--amber);margin:14px 0 8px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-triangle"></i>${diffs.length} pojazdĂłw z rozbieĹĽnoĹ›ciami wzglÄ™dem CEPiK</div>`;
    html+=`<div class="tbl-wrap" style="margin-bottom:10px"><table>
      <thead><tr><th>Nr rej.</th><th>Marka / Model</th><th>Rok</th><th>RozbieĹĽne pola</th><th></th></tr></thead>
      <tbody>${diffs.map(({v,diffs:ds,cepikData})=>`<tr>
        <td><strong style="font-family:var(--mono)">${v.nrRej}</strong></td>
        <td style="font-size:12px">${v.marka} ${v.model}</td>
        <td style="text-align:center">${v.rok||'â€”'}</td>
        <td>${ds.map(d=>`<div style="font-size:10px;margin-bottom:2px"><span style="color:var(--amber);font-weight:500">${d.label}:</span> <span style="font-family:var(--mono)">${d.baza||'â€”'}</span> <i class="ti ti-arrow-right" style="font-size:9px"></i> <span style="font-family:var(--mono);font-weight:600;color:var(--blue)">${d.cepik}</span></div>`).join('')}</td>
        <td><button class="btn btn-blue" style="font-size:11px;padding:5px 10px" onclick='cepikApplyToVeh(${v.id},${JSON.stringify(cepikData||{})})'>
          <i class="ti ti-database-import"></i>Aktualizuj
        </button></td>
      </tr>`).join('')}</tbody></table></div>
    <button class="btn btn-amber" onclick='cepikApplyAll(${JSON.stringify(diffs.map(r=>({id:r.v.id,data:r.cepikData||{}})))})'>
      <i class="ti ti-database-import"></i>Zaktualizuj wszystkie ${diffs.length} pojazdy z rozbieĹĽnoĹ›ciami
    </button>`;
  }
  if(notfound.length){
    html+=`<div class="wbox" style="margin-top:12px"><i class="ti ti-alert-triangle"></i><div><strong>${notfound.length} pojazdĂłw nie znaleziono w CEPiK:</strong> ${notfound.map(r=>r.v.nrRej).join(', ')}<br><span style="font-size:11px">SprawdĹş rÄ™cznie na historiapojazdu.gov.pl lub czy pojazdy sÄ… zarejestrowane w prawidĹ‚owym wojewĂłdztwie.</span></div></div>`;
  }
  if(ok.length){
    html+=`<div class="gbox" style="margin-top:10px"><i class="ti ti-circle-check"></i><strong>${ok.length} pojazdĂłw</strong> â€” dane w peĹ‚ni zgodne z CEPiK</div>`;
  }
  if(errs.length){
    const isCors=errs.some(r=>(r.err||'').includes('CORS')||(r.err||'').includes('fetch'));
    if(isCors) html+=showCorsHelp(true);
    else html+=`<div class="ebox" style="margin-top:10px"><i class="ti ti-alert-circle"></i>${errs.length} bĹ‚Ä™dĂłw API: ${errs.map(r=>r.v.nrRej+' ('+r.err+')').join(', ')}</div>`;
  }
  el.innerHTML=html||'<div class="gbox"><i class="ti ti-circle-check"></i>Wszystkie pojazdy zgodne z CEPiK!</div>';
}

function cepikApplyToVeh(vehId, cepikData) {
  const v=vehs.find(x=>x.id===vehId);if(!v)return;
  let applied=0;
  Object.entries(cepikData).forEach(([key,val])=>{
    if(val!==null&&val!==undefined&&String(val).trim()){v[key]=val;applied++;}
  });
  renderVeh();updateCounters();
  toast(`âś“ ${v.nrRej}: zaktualizowano ${applied} pĂłl z CEPiK`);
}

function cepikApplyAll(items) {
  let total=0;
  (items||[]).forEach(({id,data})=>{
    const v=vehs.find(x=>x.id===id);if(!v)return;
    Object.entries(data||{}).forEach(([k,val])=>{if(val!==null&&val!==undefined){v[k]=val;total++;}});
  });
  renderVeh();updateCounters();
  toast(`âś“ Zaktualizowano ${items.length} pojazdĂłw z CEPiK (${total} pĂłl Ĺ‚Ä…cznie)`);
}

// --- Auto-weryfikacja ---
function toggleCepikAuto(){cepikSettings.autoEnable=document.getElementById('cepik-auto-enable')?.checked||false;saveCepikSettings();}
function saveCepikSettings(){
  cepikSettings.autoHour=parseInt(document.getElementById('cepik-auto-hour')?.value)||6;
  cepikSettings.notify=document.getElementById('cepik-notify')?.value||'dmc';
  localStorage.setItem('dt1_cepik_settings',JSON.stringify(cepikSettings));
  toast('âś“ Ustawienia CEPiK zapisane');
}

function checkCepikAuto() {
  if(!cepikSettings.autoEnable) return;
  if(!cepikToken && !cepikConsumerKey) return;
  const last=cepikLastCheck?new Date(cepikLastCheck):null;
  if(!last||Date.now()-last.getTime()>22*60*60*1000) {
    console.log('[CEPiK] Auto-weryfikacja...');
    setTimeout(()=>cepikBatchCheck('all'),5000);
  }
}

// --- Helpers ---
function updateCepikStatsUI() {
  const s=id=>document.getElementById(id);
  if(s('cs-total'))    s('cs-total').textContent=cepikStats.total;
  if(s('cs-ok'))       s('cs-ok').textContent=cepikStats.ok;
  if(s('cs-dmc'))      s('cs-dmc').textContent=cepikStats.dmc;
  if(s('cs-vin'))      s('cs-vin').textContent=cepikStats.vin;
  if(s('cs-notfound')) s('cs-notfound').textContent=cepikStats.notfound;
  if(s('cs-err'))      s('cs-err').textContent=cepikStats.err;
  if(s('cepik-last-check'))s('cepik-last-check').textContent=cepikLastCheck||'nigdy';
  if(s('cepik-all-cnt'))   s('cepik-all-cnt').textContent=vehs.length;
  if(s('cepik-sel-cnt'))   s('cepik-sel-cnt').textContent=selected.size;
  // NastÄ™pna auto-weryfikacja
  if(s('cepik-next-check')&&cepikSettings.autoEnable){
    const h=cepikSettings.autoHour||6;
    const next=new Date();
    if(next.getHours()>=h)next.setDate(next.getDate()+1);
    next.setHours(h,0,0,0);
    s('cepik-next-check').textContent=next.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
}

function renderNeedToken() {
  return `<div class="wbox"><i class="ti ti-key"></i><div><strong>Wymagana konfiguracja CEPiK API.</strong><br>
    <span style="font-size:12px">Wpisz Klucz klienta i Klucz sekretny w sekcji Konfiguracja powyĹĽej, nastÄ™pnie kliknij <strong>PoĹ‚Ä…cz z CEPiK</strong>.<br>
    Nie masz kluczy? <a href="https://cpa.gov.pl/store/apis/info?name=CEPiK&version=1.0&provider=cpa" target="_blank" style="color:var(--blue)">Uzyskaj bezpĹ‚atnie na cpa.gov.pl â†’</a></span>
  </div></div>`;
}

function renderApiError(e, nr) {
  const isCors=e.message.includes('CORS')||e.message.includes('NetworkError')||e.message.includes('Failed to fetch');
  return isCors ? showCorsHelp(true) : `<div class="ebox"><i class="ti ti-alert-circle"></i><div><strong>BĹ‚Ä…d API dla ${nr}:</strong> ${e.message}</div></div>`;
}

function showCorsHelp(returnStr=false) {
  const html=`<div style="background:var(--amber-light);border:1px solid #EF9F27;border-radius:var(--radius-lg);padding:16px;margin-top:8px">
    <div style="font-size:13px;font-weight:600;color:#633806;margin-bottom:10px"><i class="ti ti-alert-triangle"></i> Problem CORS â€” przeglÄ…darka blokuje bezpoĹ›rednie zapytania do api.cepik.gov.pl</div>
    <div style="font-size:12px;color:#633806;margin-bottom:10px">Token jest OK! Problem polega na tym, ĹĽe CEPiK wymaga, aby zapytania przychodziĹ‚y z serwera (whitelist IP), a nie bezpoĹ›rednio z przeglÄ…darki. Token generujemy pomyĹ›lnie z api-cpa.gov.pl, ale samo api.cepik.gov.pl blokuje CORS.</div>
    <div style="font-size:12px;font-weight:600;color:#633806;margin-bottom:8px">RozwiÄ…zania:</div>
    <div style="font-size:11px;color:#7a4a06;line-height:2">
      <div><strong>1. Proxy Node.js</strong> â€” uruchom na wĹ‚asnym serwerze: <code style="background:#fff3;padding:2px 6px;border-radius:3px">npm install express node-fetch && node cepik-proxy.js</code></div>
      <div><strong>2. Whitelist IP</strong> â€” zĹ‚ĂłĹĽ wniosek do mc@mc.gov.pl o dodanie IP Twojego serwera</div>
      <div><strong>3. RÄ™cznie</strong> â€” sprawdzaj na <a href="https://historiapojazdu.gov.pl" target="_blank" style="color:#633806">historiapojazdu.gov.pl</a> i wpisuj przez formularz OCR w zakĹ‚adce OCR Dowody</div>
    </div>
    <div style="margin-top:10px">
      <div style="font-size:11px;font-weight:600;color:#633806;margin-bottom:4px">Wpisz URL proxy jeĹ›li go masz:</div>
      <div style="display:flex;gap:6px">
        <input id="cepik-proxy-inp" class="fi" placeholder="https://moj-serwer.pl/cepik-proxy" value="${cepikProxy}" style="flex:1">
        <button class="btn btn-amber" style="font-size:11px" onclick="saveCepikProxyInline()"><i class="ti ti-plug"></i>UĹĽyj proxy</button>
      </div>
    </div>
  </div>`;
  if(returnStr) return html;
  const el=document.getElementById('cepik-single-result')||document.getElementById('cepik-batch-results');
  if(el) el.innerHTML=html;
}

function saveCepikProxyInline() {
  const url=document.getElementById('cepik-proxy-inp')?.value?.trim()||'';
  if(url){
    cepikProxy=url;
    localStorage.setItem('dt1_cepik_proxy',url);
    if(document.getElementById('cepik-proxy')) document.getElementById('cepik-proxy').value=url;
    toast('âś“ Proxy zapisany â€” kolejne zapytania przez proxy');
  }
}

// --- Inicjalizacja CEPiK przy otwarciu zakĹ‚adki ---
function initCepikPage() {
  // Zawsze wstaw klucze do pĂłl formularza
  const keyInp  = document.getElementById('cepik-key');
  const secInp  = document.getElementById('cepik-secret');
  const proxyInp= document.getElementById('cepik-proxy');
  if(keyInp)   keyInp.value   = cepikConsumerKey    || localStorage.getItem('dt1_cepik_key')    || '';
  if(secInp)   secInp.value   = cepikConsumerSecret || localStorage.getItem('dt1_cepik_secret') || '';
  if(proxyInp) proxyInp.value = cepikProxy          || localStorage.getItem('dt1_cepik_proxy')  || '';

  // Status poĹ‚Ä…czenia
  if(isCepikTokenValid()) {
    const remaining = Math.round((cepikTokenExpires - Date.now()) / 1000);
    updateCepikStatus('ok');
    showTokenBox(cepikToken, remaining);
    cepikLog(`âś… PoĹ‚Ä…czono â€” token waĹĽny przez ${Math.floor(remaining/60)} min ${remaining%60} sek`, 'ok');
  } else if(cepikConsumerKey) {
    updateCepikStatus('testing');
    cepikLog('đź”„ Token wygasĹ‚ lub brak â€” generujÄ™ nowy...', 'warn');
    // Auto-refresh w tle
    cepikRefreshToken();
  } else {
    updateCepikStatus('none');
  }

  // Ustawienia auto-weryfikacji
  const autoChk  = document.getElementById('cepik-auto-enable');
  const hourSel  = document.getElementById('cepik-auto-hour');
  const notifySel= document.getElementById('cepik-notify');
  if(autoChk)    autoChk.checked = cepikSettings.autoEnable || false;
  if(hourSel)    hourSel.value   = cepikSettings.autoHour   || 6;
  if(notifySel)  notifySel.value = cepikSettings.notify     || 'dmc';

  updateCepikStatsUI();
}


// ==================== INIT ====================

// ==================== INIT ====================

window.addEventListener('load', async () => {
  if(window.TaxOrderCompanies){
  await window.TaxOrderCompanies.syncToApp();
}
  // SprawdĹş zapamiÄ™tanÄ… sesjÄ™ uĹĽytkownika
  const savedEmail = sessionStorage.getItem('dt1_user_email');
  if(savedEmail){
    const u=users.find(x=>x.email===savedEmail&&x.active);
    if(u){
      currentUser=u;
      document.getElementById('login-screen').style.display='none';
      document.getElementById('app').style.display='flex';
      document.getElementById('user-avatar').textContent=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      document.getElementById('user-name').textContent=u.name;
      document.getElementById('user-role-lbl').textContent=ROLE_LABELS[u.role]||u.role;
      applyRoleAccess(u.role);
    }
  }
  renderDash();
  window.renderVeh();
  updateCounters();

  // Badge walidacji
  setTimeout(()=>{
    const nip = tp('tp-nip');
    let errs = 0;
    if(!/^\d{10}$/.test(nip.replace(/[-\s]/g,''))) errs++;
    document.getElementById('badge-err').textContent = errs>0?errs:'âś“';
    document.getElementById('badge-err').style.background = errs>0?'var(--red)':'var(--green)';
  }, 300);

  // ===== CEPiK AUTO-CONNECT =====
  // Zapisz klucze domyĹ›lne do localStorage jeĹ›li nie ma
  if(!localStorage.getItem('dt1_cepik_key')) {
    localStorage.setItem('dt1_cepik_key',    cepikConsumerKey);
    localStorage.setItem('dt1_cepik_secret', cepikConsumerSecret);
  }

  // Uruchom auto-poĹ‚Ä…czenie z CEPiK w tle (nie blokuje UI)
  if(false) setTimeout(async () => {
    try {
      if(isCepikTokenValid()) {
        // Token jest w localStorage i waĹĽny â€” tylko zaplanuj refresh
        console.log('[CEPiK] Token waĹĽny, planujÄ™ auto-refresh');
        const remaining = Math.round((cepikTokenExpires - Date.now()) / 1000);
        scheduleTokenRefresh(Math.max(remaining - 300, 60));
        updateCepikStatus('ok');
        cepikLog(`âś… Auto-connect: token waĹĽny przez ${Math.floor(remaining/60)} min`, 'ok');
      } else {
        // Brak tokenu lub wygasĹ‚ â€” generuj nowy
        console.log('[CEPiK] GenerujÄ™ nowy token...');
        const data = await cepikGetToken(cepikConsumerKey, cepikConsumerSecret);
        cepikToken        = data.access_token;
        cepikTokenExpires = Date.now() + (data.expires_in || 3600) * 1000;
        localStorage.setItem('dt1_cepik_token',     cepikToken);
        localStorage.setItem('dt1_cepik_token_exp', String(cepikTokenExpires));
        scheduleTokenRefresh((data.expires_in || 3600) - 300);
        updateCepikStatus('ok');
        cepikLog(`âś… Auto-connect: nowy token wygenerowany (waĹĽny ${Math.floor((data.expires_in||3600)/60)} min)`, 'ok');
        console.log('[CEPiK] Token OK, wygasa za', Math.floor((data.expires_in||3600)/60), 'min');

        // PokaĹĽ status w zakĹ‚adce jeĹ›li jest otwarta
        const tokenBox = document.getElementById('cepik-token-box');
        const tokenDisp = document.getElementById('cepik-token-display');
        const tokenExp  = document.getElementById('cepik-token-expires');
        if(tokenBox)  tokenBox.style.display = 'block';
        if(tokenDisp) tokenDisp.value = cepikToken;
        if(tokenExp)  tokenExp.textContent = `(wygasa za ${Math.floor((data.expires_in||3600)/60)} min, auto-odĹ›wieĹĽanie aktywne)`;
        const rb = document.getElementById('cepik-refresh-btn');
        if(rb) rb.style.display = '';
      }
    } catch(e) {
      console.warn('[CEPiK] Auto-connect nieudany:', e.message);
      cepikLog('âš  Auto-connect: ' + e.message, 'warn');
      updateCepikStatus(e.message.includes('CORS')||e.message.includes('fetch') ? 'cors' : 'err');
    }

    // SprawdĹş auto-weryfikacjÄ™ dziennÄ…
    checkCepikAuto();
  }, 2000); // Start po 2 sek â€” ĹĽeby UI byĹ‚ juĹĽ gotowy
});

