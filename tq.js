var tq = null


document.addEventListener('DOMContentLoaded', function() {
    tq = run()
});

function run() {
    let centerNow = 0
    let hideAfterMs = 1000 * 60 * 60 * 10 //10h
    const EMD_SOUND = 'audio/1'
    const START_SOUND = 'audio/2'
    const LS_KEY = 'all-time-frames'

    function getTimeFrameId() {
        return new Date().getTime()
    }

    function gotonow() { timeline.moveTo(new Date()) }

    function notify(text, isEnd = 1) {
        try {
            let ntfArgs = {
                body: text,
                icon: 'timer.png',
                badge: 'timer.png',
                vibrate: [100, 50, 80]
            }
            let sound = EMD_SOUND
            let title = 'Out of time frame'
            if (isEnd < 1) {
                sound = START_SOUND
                title = 'In time frame'
            }
            if (!("Notification" in window))
                alert("This browser does not support system notifications")
            else if (Notification.permission === "granted") {
                new Notification(title, ntfArgs)
                playSound(sound)
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(function(result) {
                    if (permission === "granted") {
                        new Notification(title, ntfArgs)
                        playSound(sound)
                    }
                });
            }
        } catch (ex) {}

    }

    function playSound(fn) {
        document.getElementById("sound").innerHTML =
            '<audio autoplay="autoplay"><source src="' + fn + '.mp3" type="audio/mpeg" /><embed hidden="true" autostart="true" loop="false" src="' + fn + '.mp3" /></audio>';
    }

    function add() {
        tIdGen = getTimeFrameId()
        let now = new Date()
        let name = prompt('Time frame name: (--mm sets initial duration in minutes)')
        let defMin = 60
        let hasmin = name.indexOf(' --')
        if (hasmin > 2) {
            defMin = parseInt(name.substring(hasmin + 3))
            if (isNaN(defMin)) { return 60 }
            if (defMin < 0 || defMin > 999) defMin = 60
            name = name.substring(0, hasmin)
        }

        let dd = datediff({ start: new Date(), end: new Date().setMinutes(now.getMinutes() + defMin) })
        let initlabel = `${dd.h}h:${dd.m}m`

        if (name) {
            let c = `<div id="tfh-${tIdGen}"><b>${name}</b><span id="tf-${tIdGen}" class="time-frame">${initlabel}</span></div>`
            let tframe = {
                id: tIdGen,
                name: name,
                content: c,
                start: new Date().setMinutes(now.getMinutes() + 1),
                end: new Date().setMinutes(now.getMinutes() + defMin),
                isendnotified: 0,
                isstartnotified: 0
            }
            items.add(tframe)
        }
    }

    function save_to_ls(btn) {
        try {
            let All = []
            for (let i of items.get())
                All.push(JSON.stringify(i))
            localStorage.setItem(LS_KEY, JSON.stringify(All))
            btn.classList.add('saved-ok')
        } catch (ex) {
            btn.classList.add('saved-fail')
        } finally {
            setTimeout(function() {
                btn.classList.remove('saved-ok')
                btn.classList.remove('saved-fail')
            }, 800)
        }
    }

    function load_from_ls() {
        let allJson = localStorage.getItem(LS_KEY)
        return allJson ? JSON.parse(allJson) : null
    }

    function clear_ls() {
        localStorage.setItem(LS_KEY, '')
    }

    function clear() {
        items.clear()
    }

    function datediff(item) {
        let r = { d: 0, h: 0, m: 0, s: 0 }
        let end = moment(item.end)
        let start = moment(item.start)
        let duration = moment.duration(end.diff(start));
        // r.d = duration.asDays()
        r.h = Math.floor(duration.asHours())
        r.m = Math.floor(duration.asMinutes())
        if (r.h > 0) r.m -= r.h * 60
            // r.s = duration.asSeconds()
        return r
    }

    var container = document.getElementById('visualization');
    let now = new Date()
    var items = new vis.DataSet([]);

    let saved = load_from_ls()
    if (saved && saved.length > 0)
        for (let si of saved)
            items.add(JSON.parse(si))

    var options = {
        start: new Date(now).setDate(now.getHours() - 2),
        end: new Date(now).setDate(now.getHours() + 2),
        zoomMin: 1000 * 20,
        zoomMax: 1000 * 60 * 60 * 24 * 31 * 2, // 2 months in milliseconds
        height: '350px',
        multiselect: true,
        editable: {
            add: false,
            updateTime: true,
            updateGroup: true,
            remove: true,
            updateTime: true
        },
        showCurrentTime: true,
        onAdd: function(item, callback) {
            item.content = prompt('Edit items text:', item.content);
            if (item.content != null) {
                callback(item); // send back adjusted item
            } else {
                callback(null); // cancel updating the item
            }
        },
        onRemove: function(item, callback) {
            if (confirm('Delete ' + item.name)) {
                callback(item)
            }
        },
        onMoving: function(item, callback) {
            let tf = document.getElementById('tf-' + item.id)
            if (tf) {
                if (!tf.classList.contains('.time-frame-done ')) {
                    let diff = datediff(item)
                    tf.innerText = `${diff.h}h:${diff.m}m`
                    callback(item)
                } else callback(null)
            } else callback(null)
        },
        onMove: function(item, callback) {
            callback(item)
        }
    };

    let timeline = new vis.Timeline(container, items, options)
    gotonow()

    // main ticker
    setInterval(function() {
        for (let x of tq.items.get()) {
            if (x.isendnotified < 1) {
                if (x.end < Date.now()) {
                    notify(x.name, 1)
                    items.update({ id: x.id, isendnotified: 1 })
                    let e = document.getElementById(`tfh-${x.id}`)
                    if (e) e.parentElement.classList.add('time-frame-done')
                    save_to_ls()
                } else {
                    let now = Date.now()
                    if (now > x.start && now < x.end && x.isstartnotified < 1) {
                        notify(x.name, 0)
                        items.update({ id: x.id, isstartnotified: 1 })
                        save_to_ls()
                    }
                }
            } else if (Date.now() - x.end > hideAfterMs) {
                items.remove(x.id)
            }
        }
        if (centerNow > 0) gotonow()
    }, 1000)

    function track(btn) {
        btn.classList.toggle('toggle')
        centerNow = centerNow == 1 ? 0 : 1;
    }

    // zoom
    for (let i = 0; i < 4; i++)
        setTimeout(function() {
            timeline.zoomIn(1)
        }, i * 500)

    //center
    setTimeout(function() { gotonow() }, 2100)
        // set the past time frames inactive (one time only) 
    setTimeout(function() {
        for (let i of items.get()) {
            if (i.isendnotified > 0) {
                let tf = document.getElementById(`tfh-${i.id}`)
                if (tf) tf.parentElement.classList.add('time-frame-done')
            }
        }
        gotonow()
    }, 5000)


    document.addEventListener("keypress", function(e) {
        if (e && e.key == '+') add()
    });

    return {
        add,
        gotonow,
        timeline,
        clear,
        items,
        track,
        save_to_ls,
        load_from_ls,
        clear_ls,
        zoomin: function() { timeline.zoomIn(1) },
        zoomout: function() { timeline.zoomOut(1) }
    }
}