var tq = null
var swreg = null
var gcal = null

document.addEventListener('DOMContentLoaded', function() {
    tq = run()

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/tfq/sw.js').then(function(registration) {
            swreg = registration
            tq.debug_ntf('sw reg')
            console.log('Service worker registration succeeded:', registration);
        }).catch(function(error) {
            tq.debug_ntf('sw reg fail')
            console.log('Service worker registration failed:', error);
        });
    } else {
        tq.debug_ntf('no sw')
        console.log('Service workers are not supported.');
    }
});

function run() {
    let TRACE = (window.location.search.length > 3 && window.location.search.substring(0, 4) == '?err')
    let web_worker = null
    let centerNow = 0
    let hideAfterMs = 1000 * 60 * 60 * 24 * 365 // 1 year
    let selProps = null // editframe and cutframe depend on the currently selected item 
    const EMD_SOUND = document.getElementById('aud_start')
    const START_SOUND = document.getElementById('aud_end')
    const LS_KEY = 'all-time-frames'
    const SKIP_NOTIF_IF_OLDER_THAN_MS = 1000 * 60 * 10 //10 min
    const NOTIFICATION_CLOSE_AFTER = 6000 // 6sec
    let draggedtime = null
    let lockbtn = document.getElementById('lockbtn')

    // returns either the selected frame or draggedtime or NOW + 1 min
    function get_append_date() {
        if (selProps && selProps.items && selProps.items.length > 0) {
            let frame = items.get(selProps.items[0])
            if (frame) return new Date(frame.end)
        }

        if (!draggedtime) {
            let n = new Date()
            return new Date(n.setMinutes(n.getMinutes() + 1))
        } else return draggedtime
    }


    function getTimeFrameId() {
        return new Date().getTime()
    }

    function gotonow() {
        timeline.moveTo(new Date())
    }

    function gotolast() {
        let n = new Date()
        if (items) {
            for (let i of items.get()) {
                let ed = new Date(i.end)
                if (ed > n) n = ed
            }
        }

        timeline.moveTo(n)
        timeline.setCustomTime(n)
    }

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
            }

            let granted = () => {
                try {
                    if (swreg) {
                        debug_ntf('swreg.showNotification')
                        swreg.showNotification(title, ntfArgs)
                    } else {
                        debug_ntf('new Notification')
                        let n = new Notification(title, ntfArgs)
                        setTimeout(() => { n.close() }, NOTIFICATION_CLOSE_AFTER);
                    }
                    if (sound) sound.play()
                } catch (ex) { debug_ntf('ex in granted: ' + ex) }
            }

            if ("Notification" in window) {
                if (Notification.permission === "granted") granted()
                else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(function(result) {
                        if (result === "granted") granted()
                    })
                }
            }
        } catch (ex) {}
    }

    function add() {
        let tIdGen = getTimeFrameId()
        let now = new Date()
        let name = prompt(`Time frame name: \n --mm sets a duration in minutes, default is 60 \n select a frame to append `)
        let defMin = 60
        let hasmin = name.indexOf(' --') // duration in min

        if (hasmin > 0) {
            defMin = parseInt(name.substring(hasmin + 3))
            if (isNaN(defMin)) { return 60 }
            if (defMin < 0 || defMin > 9999) defMin = 60
            name = name.substring(0, hasmin)
        }

        let dd = datediff({ start: new Date(), end: new Date().setMinutes(now.getMinutes() + defMin) })
        let initlabel = `${dd.h}h:${dd.m}m`
        let startTime = get_append_date()
        if (name) {
            let endTime = new Date(startTime).setMinutes(startTime.getMinutes() + defMin)
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

    function create(name, dates, props) {
        if (!name) name = prompt('Frame label:')
        let tIdGen = getTimeFrameId()
        if (!dates) dates = getDatesFromInputs()
        if (!dates || isNaN(dates[0].getTime()) || isNaN(dates[1].getTime())) {
            ntf('The dates are incorrect.', 'ntf-fail')
            return
        }
        if (name) {
            let dd = datediff({ start: dates[0], end: dates[1] })
            let initlabel = `${dd.h}h:${dd.m}m`
            let c = `<div id="tfh-${tIdGen}"><b class="tf-text" >${name}</b><span id="tf-${tIdGen}" class="time-frame">${initlabel}</span></div>`
            let tframe = {
                id: tIdGen,
                name: name,
                content: c,
                start: dates[0],
                end: dates[1],
                isendnotified: 0,
                isstartnotified: 0
            }
            if (props)
                for (key of Object.keys(props))
                    tframe[key] = props[key]
            items.add(tframe)
        }
    }

    function save_to_ls(btn) {
        try {
            let All = []
            for (let i of items.get())
                if (!i.imported || i.imported < 1)
                    All.push(JSON.stringify(i))

            localStorage.setItem(LS_KEY, JSON.stringify(All))
            if (btn) btn.classList.add('b-ok')
            ntf('saved', 'ntf-ok')
        } catch (ex) {
            if (btn) btn.classList.add('b-fail')
            ntf('failed', 'ntf-fail')
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
                if (btn) btn.classList.add('b-ok')
                ntf('cleared', 'ntf-ok')
            }
        } catch (ex) {
            if (btn) btn.classList.add('b-fail')
            ntf('clear failed', 'ntf-ok')
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

    let startDatePicker = document.getElementById('startDatePicker')
    let endDatePicker = document.getElementById('endDatePicker')
    let startTimePicker = document.getElementById('startTimePicker')
    let endTimePicker = document.getElementById('endTimePicker')
    let container = document.getElementById('visualization');
    let now = new Date()
    var items = new vis.DataSet([]);

    let saved = load_from_ls()
    if (saved && saved.length > 0) {
        for (let si of saved) {
            let tf = JSON.parse(si)
            if (tf) {
                if (tf.start) tf.start = new Date(tf.start)
                if (tf.end) tf.end = new Date(tf.end)
                items.add(tf)
            }
        }
    }

    var options = {
        start: new Date(now).setDate(now.getHours() - 2),
        end: new Date(now).setDate(now.getHours() + 2),
        zoomMin: 1000 * 20,
        zoomMax: 1000 * 60 * 60 * 24 * 31 * 2, // 2 months in milliseconds
        height: '350px',
        margin: { axis: 30, item: { vertical: 4, horizontal: -0.5 } },
        multiselect: true,
        editable: {
            add: false,
            updateTime: true,
            updateGroup: true,
            remove: true,
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
                let s = new Date(item.start)
                let e = new Date(item.end)
                setDateToInputs(startDatePicker, startTimePicker, s)
                setDateToInputs(endDatePicker, endTimePicker, e)
                callback(item)
            } else callback(null)
        },
        onMove: function(item, callback) {
            callback(item)
        }
    };

    let timeline = null;

    function create_timeline() {
        container.innerHTML = ''
        timeline = new vis.Timeline(container, items, options)

        timeline.addCustomTime(new Date())

        timeline.on('timechange', function(event) {
            draggedtime = new Date(event.time)
        });

        timeline.on('select', function(d) {
            if (TRACE) console.log(d);
            selProps = d
            if (d && d.items && d.items.length > 0) {
                let frame = items.get(selProps.items[0])
                if (frame) {
                    let s = new Date(frame.start)
                    let e = new Date(frame.end)
                    setDateToInputs(startDatePicker, startTimePicker, s)
                    setDateToInputs(endDatePicker, endTimePicker, e)
                    updatelockbtn(frame)
                }
            }
        });

    }

    create_timeline();

    setDateToInputs(startDatePicker, startTimePicker, new Date())
    setDateToInputs(endDatePicker, endTimePicker, new Date())

    function updatelockbtn(frame) {
        if (frame) {
            if (!frame.editable) lockbtn.innerText = 'lock'
            else lockbtn.innerText = frame.editable.updateTime === true ? 'lock' : 'unlock'
        }
    }

    function setDateToInputs(inputDate, inputTime, date) {
        if (date) {
            let m = moment(date)
            if (inputDate) inputDate.value = m.format('YYYY-MM-DD')
            if (inputTime) inputTime.value = m.format('HH:mm')
        }
    }

    function getDatesFromInputs() {
        let sdt = moment(startDatePicker.value + " " + startTimePicker.value)
        let edt = moment(endDatePicker.value + " " + endTimePicker.value)
        let r = []
        if (sdt) r.push(sdt.toDate())
        if (edt) r.push(edt.toDate())
        if (sdt >= edt) {
            ntf('The time-frame duration is negative', 'ntf-fail', 5000)
            return null
        }
        return r
    }

    function update_dates() {
        if (selProps && selProps.items && selProps.items.length > 0) {
            let frame = items.get(selProps.items[0])
            if (frame) {
                let dates = getDatesFromInputs()
                if (dates && dates.length > 0) {
                    let upd = { id: selProps.items[0] }
                    if (dates[0]) upd.start = dates[0]
                    if (dates[1]) upd.end = dates[1]
                    let t = document.getElementById(`tfh-${selProps.items[0]}`)
                    let tf = document.getElementById('tf-' + frame.id)
                    if (t && tf) {
                        let diff = datediff(upd)
                        tf.innerText = `${diff.h}h:${diff.m}m`
                        upd.content = t.outerHTML
                    }
                    items.update(upd)
                    ntf('updated', 'ntf-ok')
                }
            }
        }

    }


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
                let now = Date.now()
                let xstart = new Date(x.start).valueOf()
                let xend = new Date(x.end).valueOf()
                if (xend < now) {
                    if (now - xend < SKIP_NOTIF_IF_OLDER_THAN_MS) notify(x.name, 1)
                    items.update({ id: x.id, isendnotified: 1, className: 'past locked', editable: { updateTime: false, updateGroup: false, remove: true } })
                    save_to_ls()
                } else {
                    if (now > xstart && now < xend && x.isstartnotified < 1) {
                        if (now - xstart < SKIP_NOTIF_IF_OLDER_THAN_MS) notify(x.name, 0)
                        let css = !x.imported || x.imported < 1 ? 'active' : 'imported'
                        if (x.editable && x.editable.updateTime === false) css += ' locked'
                        items.update({ id: x.id, isstartnotified: 1, className: css })
                        save_to_ls()
                    } else if (xstart > now) {
                        let css = !x.imported || x.imported < 1 ? '' : 'imported'
                        if (x.editable && x.editable.updateTime === false) css += ' locked'
                        items.update({ id: x.id, isstartnotified: 0, className: css })
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


    function info() {
        let i = document.getElementById('info')
        i.classList.toggle('hidden')
    }

    function toggle_set_dates() {
        let i = document.getElementById('dateTimePickers')
        i.classList.toggle('hidden')
    }

    function lockframe() {
        if (selProps && selProps.items && selProps.items.length > 0) {
            let frame = items.get(selProps.items[0])
            if (frame) {
                if (frame.imported) {
                    ntf('Cannot modify imported frames', 'ntf-fail', 4000)
                    return
                }
                if (frame.editable && frame.editable.updateTime != null) {
                    frame.editable.updateTime = !frame.editable.updateTime
                    togglecss(frame, 'locked', frame.editable.updateTime ? 0 : 1)
                } else {
                    frame.editable = { updateTime: false, remove: true }
                    togglecss(frame, 'locked', 1)
                }
                items.update(frame)
                updatelockbtn(frame)
                    // let text = frame.editable.updateTime === true ? 'unlocked' : 'locked'
                    // ntf('frame ' + text, 'ntf-ok')
            }
        }
    }

    function togglecss(item, css, add = 1) {
        if (item) {
            if (add > 0) {
                if (item.className.indexOf(css) < 0) item.className += ' ' + css
            } else item.className = item.className.replace(css, '')
        }
    }

    let ntfdiv = document.getElementById('ntf')

    function debug_ntf(text, css = 'ntf-debug', dur = 30000) {
        if (TRACE) {
            ntf(text, css, dur)
        }
    }

    function ntf(text, css, dur = 1000) {
        let newntf = document.createElement('div')
        newntf.innerHTML = text
        newntf.classList.add(css)
        newntf.classList.add('newntf')
        ntfdiv.appendChild(newntf)
        newntf.onclick = () => { newntf.remove() }
        setTimeout(function() {
            ntfdiv.removeChild(newntf)
        }, dur)
    }

    function hide_time(dates) {
        if (!dates) dates = getDatesFromInputs()
        if (dates && dates.length > 1) {
            if (isNaN(dates[0]) || isNaN(dates[1])) { ntf('Invalid dates.', 'ntf-fail'); return }
            options.hiddenDates = [{
                start: dates[0],
                end: dates[1],
                repeat: 'daily'
            }]
            create_timeline()
            gotonow()
        }
    }

    function hide_07() {
        let n = new Date()
        let e = new Date()
        n.setHours(0, 0, 0, 0)
        e.setHours(7, 0, 0, 0)
        hide_time([n, e])
    }

    function hide_19_8() {
        let s = new Date()
        let e = new Date()
        s.setHours(19, 0, 0, 0)
        e.setDate(e.getDate() + 1)
        e.setHours(8, 0, 0, 0)
        hide_time([s, e])
    }

    gcal = new gooc()

    return {
        create,
        add,
        toggle_set_dates,
        update_dates,
        gotonow,
        gotolast,
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
        cutframe,
        lockframe,
        info,
        ntf,
        debug_ntf,
        hide_time,
        hide_07,
        hide_19_8
    }
}

function gooc() {
    function registerjs() {
        let scr = document.getElementById('goog')
        if (!scr) {
            src = document.createElement('script')
            src.id = 'goog'
            src.onload = function() {
                if (gcal) gcal.handleClientLoad()
            }
        }
        src.setAttribute('defer', '')
        src.setAttribute('src', 'https://apis.google.com/js/api.js')
        document.head.appendChild(src)
    }


    registerjs()

    var CLIENT_ID = '189775219070-f43ndgfe1sjakmp3q065000ek8tq4f27.apps.googleusercontent.com';
    var API_KEY = 'AIzaSyDjDM4STm3EEz2Q78L2c4RQerlzTcjh604';
    var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
    var SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

    var authorizeButton = document.getElementById('authorize-button');
    var signoutButton = document.getElementById('signout-button');

    function handleClientLoad() {
        tq.debug_ntf('goog loaded')
        gapi.load('client:auth2', initClient);
    }

    function initClient() {
        gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
        }).then(function() {
            authorizeButton.onclick = () => gapi.auth2.getAuthInstance().signIn().then(() => {
                updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get())
            })
            signoutButton.onclick = () => {
                let auth2 = gapi.auth2.getAuthInstance();
                auth2.signOut().then(() => {
                    auth2.disconnect()
                    let isin = gapi.auth2.getAuthInstance().isSignedIn.get()
                    console.log("in:" + isin)
                    updateSigninStatus(false) // because of auth2.disconnect()
                    tq.ntf('Calendar read permissions revoked', 'ntf-ok')
                })
            }
        });
    }

    function updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            authorizeButton.classList.add('hidden')
            signoutButton.classList.remove('hidden')
            listUpcomingEvents();
        } else {
            authorizeButton.classList.remove('hidden')
            signoutButton.classList.add('hidden')
        }
    }

    function listUpcomingEvents(maxResults = 100) {
        gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': maxResults,
            'orderBy': 'startTime'
        }).then(function(response) {
            let E = response.result.items;
            if (E.length > 0) {
                // remove all imported items before adding from google
                // because the id's will be different
                for (let gi of tq.items.get())
                    if (gi.imported)
                        tq.items.remove(gi.id)
                for (let i of E) {
                    if (i.start && i.start.dateTime && i.end && i.end.dateTime) {
                        let dates = [new Date(i.start.dateTime), new Date(i.end.dateTime)]
                        let props = {
                            className: 'imported',
                            editable: { updateTime: false, remove: false },
                            imported: 1 //prevent saving
                        }
                        tq.create(i.summary, dates, props)
                    }
                }
            } else tq.ntf('No upcoming events found.', 'ntf-ok', 2000)
        });
    }

    return {
        handleClientLoad,
        initClient,
        updateSigninStatus,
        listUpcomingEvents
    }
}