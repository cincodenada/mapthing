library('zoo')

post_process = function(track) {
  dbg_len = function(x, label) {
    print(paste(label, "=", nrow(x)));
    x
  }
  zt = track %>%
    dbg_len("Start") %>%
    unique() %>%
    dbg_len("Uniq") %>%
    group_by(Time) %>%
    arrange(ordered(Source, c('gps', 'network'))) %>%
    filter(row_number()==1) %>%
    ungroup() %>%
    dbg_len("Dedup") %>%
    mutate(
      dist = c(NA, distHaversine(data.frame(Longitude, Latitude))),
    )
}

zooify = function(x) {
  zt = zoo(x, order.by=x$Time)
  zg = zoo(, seq(start(zt), end(zt), "sec"))

  merge(zt, zg)
}

timewindow = function(x, secs) {
  target = x[[1]] + secs;
  tidx = 1
  window = c()
  for(i in 1:length(x)) {
    while(target <= x[[i]]) {
      window = c(window, i - tidx);
      tidx = tidx + 1;
      target = x[[tidx]] + secs;
    }
  }
  while(tidx <= length(x)) {
      window = c(window,length(x) - tidx);
      tidx = tidx + 1;
  }
  window
}

rollsd = function(x, windowsize) {
  frollapply(x, windowsize, sd, adaptive=T)
}

roll_cols = function(x, windowsize, func, ...) {
  rollapply(x, windowsize, function(row) {
    z = zoo(row)
    c(
      lat_sd=func(z$Latitude, ...),
      lon_sd=func(z$Longitude, ...)
    )
  }, by.column=F)
}

thresh = function(x, lowt, hight) {
  low = (x$lat_sd + x$lon_sd) * 1e5 < lowt
  high = (x$lat_sd + x$lon_sd) * 1e5 > hight
  merge(low, high)
}

edge = function(x) {
  sparse = x[!is.na(x$low)]
  state = rollapply(sparse, 2, function(x) {
    if(x[2,"low"] && !x[1,"low"]) {
      return("start")
    } else if(!x[1,"high"] && x[2, "high"]) {
      return("end")
    }
  }, by.column=F)
  state[!is.na(state)]
}
