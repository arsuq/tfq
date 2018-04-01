var tq = null
var swreg = null

document.addEventListener('DOMContentLoaded', function() {
    tq = run()

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/tfq/sw.js').then(function(registration) {
            swreg = registration
            console.log('Service worker registration succeeded:', registration);
        }).catch(function(error) {
            console.log('Service worker registration failed:', error);
        });
    } else {
        console.log('Service workers are not supported.');
    }
});

function run() {
    let web_worker = null
    let centerNow = 0
    let hideAfterMs = 1000 * 60 * 60 * 24 * 365 // 1 year
    const EMD_SOUND = 'audio/1'
    const START_SOUND = 'audio/2'
    const LS_KEY = 'all-time-frames'
    let max_date = new Date()


    function getTimeFrameId() {
        return new Date().getTime()
    }

    function gotonow() { timeline.moveTo(new Date()) }

    function notify(text, isEnd = 1) {
        try {
            let sound = EMD_SOUND
            let title = 'Out of time frame'
            if (isEnd < 1) {
                sound = START_SOUND
                title = 'In time frame'
            }
            let ntfArgs = {
                body: text,
                icon: 'timer.png',
                badge: 'icons/new.png'
                    // silent: true,
                    // sound: sound // not supported yet
            }

            let granted = () => {
                if (swreg) swreg.showNotification(title, ntfArgs)
                else new Notification(title, ntfArgs)
                playSound(sound)
            }

            if (!("Notification" in window)) alert("This browser does not support system notifications")
            else if (Notification.permission === "granted") granted()
            else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(function(result) {
                    if (result === "granted") granted()
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
        let name = prompt(`Time frame name: \n --mm sets a duration in minutes, default is 60 \n << will start 1 min from now, the defaut is the last frame's end \n + is a shortcut to add `)
        let defMin = 60
        let hasmin = name.indexOf(' --') // duration in min
        let immediate = name.indexOf(' <<') // immediate start

        if (hasmin > 0) {
            defMin = parseInt(name.substring(hasmin + 3))
            if (isNaN(defMin)) { return 60 }
            if (defMin < 0 || defMin > 999) defMin = 60
            name = name.substring(0, hasmin)
        }

        let dd = datediff({ start: new Date(), end: new Date().setMinutes(now.getMinutes() + defMin) })
        let initlabel = `${dd.h}h:${dd.m}m`
        let startTime = new Date(now.setMinutes(now.getMinutes() + 1)) // in 1 min
        if (immediate < 0 && startTime < max_date) startTime = new Date(max_date)
        if (name) {
            let endTime = new Date(startTime).setMinutes(startTime.getMinutes() + defMin)
            if (endTime > max_date) max_date = new Date(endTime)
            let c = `<div id="tfh-${tIdGen}"><b class="tf-text" >${name}</b><span id="tf-${tIdGen}" class="time-frame">${initlabel}</span></div>`
            let tframe = {
                id: tIdGen,
                name: name,
                content: c,
                start: startTime,
                end: endTime,
                isendnotified: 0,
                isstartnotified: 0
                    // type: 'range'
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
            if (btn) btn.classList.add('b-ok')
        } catch (ex) {
            if (btn) btn.classList.add('b-fail')
        } finally {
            if (btn)
                setTimeout(function() {
                    btn.classList.remove('b-ok')
                    btn.classList.remove('b-fail')
                }, 800)
        }
    }

    function load_from_ls() {
        let allJson = localStorage.getItem(LS_KEY)
        return allJson ? JSON.parse(allJson) : null
    }

    function clear_ls(btn) {
        try {
            if (confirm('Delete all frames from the local storage?')) {
                localStorage.setItem(LS_KEY, '')
                items.clear()
                max_date = new Date()
                if (btn) btn.classList.add('b-ok')
            }
        } catch (ex) {
            if (btn) btn.classList.add('b-fail')
        } finally {
            if (btn)
                setTimeout(function() {
                    btn.classList.remove('b-ok')
                    btn.classList.remove('b-fail')
                }, 800)
        }
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
        for (let si of saved) {
            let tf = JSON.parse(si)
            if (tf) {
                if (tf.end) {
                    let tfendDate = new Date(tf.end)
                    if (tfendDate > max_date) max_date = new Date(tf.end)
                }
                items.add(tf)
            }
        }

    var options = {
        start: new Date(now).setDate(now.getHours() - 2),
        end: new Date(now).setDate(now.getHours() + 2),
        zoomMin: 1000 * 20,
        zoomMax: 1000 * 60 * 60 * 24 * 31 * 2, // 2 months in milliseconds
        height: '350px',
        // margin: { axis: 25, item: { vertical: 8, horizontal: -0.5 } },
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
                let diff = datediff(item)
                tf.innerText = `${diff.h}h:${diff.m}m`
                callback(item)
            } else callback(null)
        },
        onMove: function(item, callback) {
            callback(item)
        }
    };

    let timeline = new vis.Timeline(container, items, options)

    // editframe and cutframe depend on the currently selected item 
    let selProps = null

    timeline.on('select', function(d) {
        console.log(d);
        selProps = d
    });

    function editframe() {
        if (selProps.items && selProps.items.length > 0) {
            let t = document.getElementById(`tfh-${selProps.items[0]}`)
            if (t) {
                let b = t.querySelectorAll(`.tf-text`)
                if (b.length > 0) {
                    let text = prompt('Edit text', b[0].innerHTML)
                    b[0].innerHTML = text
                    items.update({ id: selProps.items[0], content: t.outerHTML })
                }
            }
        }
    }


    function cutframe() {
        if (selProps.items && selProps.items.length > 0) {
            let t = document.getElementById(`tfh-${selProps.items[0]}`)
            let frame = items.get(selProps.items[0])
            if (t && frame) {
                let s = new Date(frame.start)
                let e = new Date(frame.end)
                let n = new Date()
                if (s < n && n < e) {
                    let b = t.querySelectorAll(`.tf-text`)
                    if (b.length > 0 && confirm(`Cut ${b[0].innerText}?`)) {
                        let tf = t.querySelectorAll(`[id='tf-${frame.id}']`) // the span with the time
                        if (tf.length > 0) {
                            let diff = datediff(frame)
                            tf[0].innerText = `${diff.h}h:${diff.m}m`
                        }
                        items.update({ id: selProps.items[0], end: n, content: t.outerHTML })
                    }
                }
            }
        }
    }

    gotonow()

    // there is no real use of the web worker, 
    // all browsers will kill the ticker when 
    // the page is not active
    function start_web_workwer() {
        if (typeof(Worker) !== "undefined") {
            web_worker = new Worker("bw.js");
            web_worker.onmessage = function(e) {
                tick();
            };
        } else { window.alert("I need web workers."); }
    }

    start_web_workwer()

    // main ticker
    function tick() {
        for (let x of tq.items.get()) {
            if (x.isendnotified < 1) {
                if (x.end < Date.now()) {
                    notify(x.name, 1)
                    items.update({ id: x.id, isendnotified: 1, editable: { updateTime: false, updateGroup: false, remove: true } })
                    let e = document.getElementById(`tfh-${x.id}`)
                    if (e && e.parentElement) {
                        e.parentElement.classList.add('time-frame-done')
                    }
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
    }

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
        zoomout: function() { timeline.zoomOut(1) },
        editframe,
        cutframe
    }
}