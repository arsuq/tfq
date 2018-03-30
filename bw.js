let on = 1
setInterval(function() {
    if (on > 0) postMessage('tick')
}, 1000)
onmessage = function(е) {
    if (е.data[0] === "on") {
        on = parseInt(е.data[1])
    }
}