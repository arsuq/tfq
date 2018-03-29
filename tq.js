var tq = null


document.addEventListener('DOMContentLoaded', function() {
    tq = run()
});

function run() {
    let tIdGen = 1
    let centerNow = 0
    let hideAfterMs = 1000 * 60 * 60 * 10 //10h

    function gotonow() {
        timeline.moveTo(new Date())
    }

    function notifyMe(text) {
        const SOUND = 'audio/1'
        let options = {
            body: text,
            // image: 'timer.png',
            icon: 'timer.png'
        }

        if (!("Notification" in window))
            alert("This browser does not support system notifications")
        else if (Notification.permission === "granted") {
            new Notification("End of time frame", options)
            playSound(SOUND)
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission(function(permission) {
                if (permission === "granted") {
                    new Notification("End of time frame", options)
                    playSound(SOUND)
                }
            });
        }

    }

    function playSound(fn) {
        document.getElementById("sound").innerHTML =
            '<audio autoplay="autoplay"><source src="' + fn + '.mp3" type="audio/mpeg" /><embed hidden="true" autostart="true" loop="false" src="' + fn + '.mp3" /></audio>';
    }

    function add() {
        tIdGen++
        let now = new Date()
        let name = prompt('Time frame name:')
        if (name) {
            let c = `<div id="tfh-${tIdGen}"><b>${name}</b><span id="tf-${tIdGen}" class="time-frame">1h</span></div>`
            items.add({
                id: tIdGen,
                name: name,
                content: c,
                start: now,
                end: new Date().setHours(now.getHours() + 1),
                isnotified: 0
            })
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

    let d2 = (new Date().setHours(now.getHours() + 1))

    var items = new vis.DataSet([]);
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
            remove: true
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
        }

    };

    var timeline = new vis.Timeline(container, items, options)
    gotonow()

    setInterval(function() {
        for (let x of tq.items.get()) {
            if (x.isnotified < 1) {
                if (x.end < Date.now()) {
                    notifyMe(x.name)
                    items.update({ id: x.id, isnotified: 1 })
                    let e = document.getElementById(`tfh-${x.id}`)
                    if (e) e.parentElement.classList.add('time-frame-done')

                }
            } else if (Date.now() - x.end > hideAfterMs) {
                console.log(Date.now() - x.end)
                items.remove(x.id)
            }
        }
        if (centerNow > 0) gotonow()
    }, 1000)

    function track(btn) {
        btn.classList.toggle('toggle')
        centerNow = centerNow == 1 ? 0 : 1;
    }

    for (let i = 0; i < 4; i++)
        setTimeout(function() {
            timeline.zoomIn(1)
        }, i * 500)

    setTimeout(function() {
        gotonow()
    }, 2100)

    return {
        add,
        gotonow,
        timeline,
        clear,
        items,
        track
    }
}