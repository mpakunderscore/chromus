var PlayerUI = {
    playlist: [],
    state: {}
}

PlayerUI.loadPlaylist = function(data){    
    var html = '';
    var merge_rows = 0;
    var length = data.length;
    var playlist_tmpl = $('#playlist_tmpl');

    for(var i=0; i<length; i++){
        if(merge_rows){
            merge_rows -= 1;
            data[i].hide_artist = true;

            if(merge_rows == 0)
                data[i].last_row = true;
        } else {
            merge_rows = this.artistInLine(i, data);

            if(merge_rows > 1){
                data[i].merge_rows = merge_rows+1; 
                data[i].artist_image = Scrobbler.getImage({artist: data[i].artist});
            } else {
                merge_rows = 0;
            }
        }
    }
    
    var pane = $("#playlist").data('jsp');
    
    if (pane) {
        pane.getContentPane().html(playlist_tmpl.tmpl({playlist: data}));
        
        pane.reinitialise();
    } else {
        playlist_tmpl.tmpl({playlist: data}).appendTo("#playlist");        
        
        $("#playlist").jScrollPane({
            maintainPosition: true
        }); 
    }

    this.playlist = data;
}


PlayerUI.artistInLine = function(start_from, arr){
    var length = arr.length;
    var counter = 0;

    if(start_from >= length)
        return counter;

    for(var i=start_from+1; i<length; i++){
        if(arr[i].artist && arr[start_from].artist && arr[i].artist.replaceEntities() === arr[start_from].artist.replaceEntities())
            counter += 1;
        else
            return counter;
    }                

    return counter;
}

PlayerUI.setCurrentTrack = function(track_number, update_info){
    var track = this.playlist[track_number];

    this.current_track = track_number;

    $("#playlist .playing").removeClass("playing");

    if(track)
        $($("#playlist .track_td").get(track_number)).addClass("playing");
    
    
    if(update_info){
        var cur_song = $('#current_song');

        if(track){
            cur_song.find('.container').show();

            var track_img =  cur_song.find('.album_img img').get(0);
            track_img.src = Scrobbler.getImage({artist: track.artist, album: track.album});

            cur_song.find('.info .song').html(track.song);
            cur_song.find('.info .artist').html(track.artist);
        } else {
            cur_song.find('.container').hide();
        }


        if(track && track.album){
            cur_song.find('.info .album').html(track.album);
            cur_song.find('.info .album, .info .dash').show();
        } else {
            cur_song.find('.info .album, .info .dash').hide();
        }    

        cur_song.css({visibility:'visible'});

        if (track && track.source_title || track.source_url) {
            var source_title = track.source_title || track.source_host;
            var source_icon = track.source_icon || "http://"+track.source_host + "/favicon.ico";
            var source_url = track.source_url || "javascript:;";
            
            cur_song.find('.source').html("<a href='"+source_url+"'><img width='11px;' height='11px;' src='"+source_icon+"'/>&nbsp;"+source_title+"</a>");            
        } else {
            cur_song.find('.source').html('');
        }
    }
}

PlayerUI.setState = function(state){
    PlayerUI.state = state;

    var controls = $("#header");
    
    if(state.played)
        controls.find('.inner').width(276.0*state.played/state.duration);    
    else
        controls.find('.inner').width(0);    

    if(state.buffered)
        controls.find('.progress').width(278.0*state.buffered/state.duration);
    else
        controls.find('.progress').width(0);    

    if(state.played != 0)
        controls.find('.time').html(prettyTime(state.played));
    else
        controls.find('.time').html("");

    if (state.volume != undefined && !$('#header .volume .level').is(':visible')) {
        this.setVolume(state.volume);   
    }   

}


PlayerUI.setVolume = function(level, send_message){
    if(level > 100) level = 100;
    if(level < 0) level = 0;
    
    $('#header .volume .level').css({height:(100-level)+'%'});
    
    this.state.volume = level;

    if (send_message) {
        browser.postMessage({ method:'setVolume', volume: level });
    }
}


PlayerUI.initialize = function(){
    $('#header .volume').mouseenter(function(){
        clearTimeout(this.hide_timeout);

        this.show_timeout = setTimeout(function(){            
            $('#header .volume .volume_bar').show();
        }, 300);
    }).mouseleave(function(){
        clearTimeout(this.show_timeout);

        this.hide_timeout = setTimeout(function(){
            $('#header .volume .volume_bar').hide();
        }, 500);
    }).click(function(){
        $('#header .volume_bar').toggle();
    });
    

    $('#header .volume_bar').click(function(e){
        var level = (e.clientY - 40);

        level = 100 - level;
        
        PlayerUI.setVolume(level, true);
    });
    
    $('#header').mousewheel(function(e, delta){
        console.log('delta:', delta);
        
        var level = PlayerUI.state.volume + delta*10;

        PlayerUI.setVolume(level, true);
    });
    
    $('#header .search').click(function(){
        var search_bar = $('#header .search_bar');

        if(search_bar.is(':visible'))
           search_bar.hide();
        else {
           search_bar.show();
           search_bar.find('input').focus();
        }
    });

    $(document).click(function(e){
        var target = $(e.target);

        if(target.hasClass('sm2_button'))
            browser.postMessage({
                method:'play',
                track: getTrackInfo(e.target),
                playlist: [getTrackInfo(e.target)]
            });

        else if(target.hasClass('add_to_queue'))
            browser.postMessage({
                method: 'add_to_playlist',
                track: getTrackInfo(e.target)
            });

        else {
            var search_bar = $('#header .search_bar');

            if(search_bar.is(':visible'))
                if($(e.target).parents('#header').length == 0)
                    search_bar.hide();
            }
    });

    $('#header .control.next').click(function(){
        browser.postMessage({ method: 'nextTrack' });

        PlayerUI.setCurrentTrack(PlayerUI.current_track + 1);
    });

    $('#header *[data-role=toggle]').bind('click', function(){
        $(this).toggleClass('pause')
               .toggleClass('play');
        
        if ($(this).hasClass('pause')) {
            browser.postMessage({ method:'play', track: PlayerUI.current_track });
        } else {
            browser.postMessage({ method:'pause' });
        }
    });


    $('#playlist').click(function(e){
        var target = $(e.target);

        if(target.hasClass('track') && !target.hasClass('playing')){
            var index = target.parents('.track_td')[0].getAttribute('data-index');            
            index = parseInt(index);

            browser.postMessage({method:'play', track: index});
            
            PlayerUI.setCurrentTrack(index);
        }
    });

    $('#header .search_bar .text').keyup(function(evt){
        this.interval = setTimeout(PlayerUI.search, 300);
    }).keydown(function(evt){
        clearInterval(this.interval);
    });    
}


PlayerUI.search = function(){
    var text = $('#header .search_bar .text').val();
    
    if (!text.trim())
        $('#header .search_bar .result').html('');
    else
        Scrobbler.search(text, function(response){
            $('#header .search_bar .result').html(response.html);
    });
}

PlayerUI.showMainMenu = function() {
    var template = $('#main_menu_tmpl');

    $('#main_menu').html(template.tmpl({
        settings: PlayerUI.settings
    })).show();
    
    $('#main_menu .search_lyrics').click(function() {        
        // I'm feeling lucky
        var track = PlayerUI.playlist[PlayerUI.current_track];
        browser.tabs.create({url: "http://google.com/search?sourceid=navclient&btnI=I%27m+Feeling+Lucky&q="+track.artist+' '+track.song + ' lyrics'});
    });

    $('#main_menu .options').click(function() {
        browser.tabs.create({url: browser.extension.getURL('options.html')});
    });
    
    $('#main_menu .scrobbling').click(function() {        
        if ($(this).hasClass('not_logged')) {
            browser.tabs.create({url: Scrobbler.authURL()});

        } else if ($(this).hasClass('disabled')) {
            $(this).removeClass('disabled');
            
            PlayerUI.settings.scrobbling = true;

            browser.postMessage({ method: "setScrobbling", scrobbling: true });
        } else {
            $(this).addClass('disabled');

            PlayerUI.settings.scrobbling = false;

            browser.postMessage({ method: "setScrobbling", scrobbling: false });
        }
    });
    
    $('#main_menu .loved_radio').click(function() {
        browser.postMessage({ method: "lovedRadio" });
    });

    $('#main_menu .clear_playlist').click(function() {
        PlayerUI.loadPlaylist([]);
        browser.postMessage({ method: "clearPlaylist" });
    });
    
    $('#main_menu .lastfm_radio').click(function() {
        browser.postMessage({ method: "lastfmRadio", url: $(this).attr('data-radio') });
    });
}


browser.addMessageListener(function(msg) {
    if (msg.method != 'updateState') 
        console.log("Popup received message", msg);
        
    switch(msg.method){        
        case 'loadPlaylist':
            console.log("Loading Playlist: ", msg);

            PlayerUI.loadPlaylist(msg.playlist);            
                        
            // Timeout for scroll pane initialization
            if(msg.current_track != undefined){
                    PlayerUI.setCurrentTrack(msg.current_track, true);

                    var scroll_to = $("#playlist tr").get(msg.current_track).offsetTop-60;
                    $("#playlist").data('jsp').scrollToY(scroll_to);
            }

            if(msg.state != undefined) {
                PlayerUI.setState(msg.state);

                if (msg.state.paused) {
                    $('#header *[data-role=toggle]').removeClass('play').addClass('pause');
                } else {
                    $('#header *[data-role=toggle]').removeClass('pause').addClass('play');
                }
            }

            $('#playlist').css({'visibility': 'visible'})

            break;

        case 'loading':
            PlayerUI.setCurrentTrack(msg.track_index);
            break;

        case 'play':
            PlayerUI.playlist[msg.track_index] = msg.track;

            PlayerUI.setCurrentTrack(msg.track_index, true);
            break;

        case 'updateState':
            PlayerUI.setState(msg.state);
            break;

        case 'setSettings':
            PlayerUI.settings = msg.settings;

            PlayerUI.showMainMenu();
            break;

        default:
            console.log('Unknown method:', msg);
    }
});

$(document).ready(function(){
    if (browser.isOpera) {
        document.getElementById('playlist').style.height = '460px';
        document.getElementById('wrapper').style.marginTop = '5px';       
    } else if (browser.isSafari) {
        document.getElementById('playlist').style.height = '470px';    
    }

    PlayerUI.initialize();        
    
    browser.onReady( function() {
        browser.postMessage({method:'getPlaylist'});
        browser.postMessage({method:'getSettings'});        
    })
});
