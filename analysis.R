library('data.table')
library('geosphere')
library('gpx')
library('zoo')
library('tidyverse')

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

if(!exists('gpx')) {
  gpx = read_gpx('1050d3c2d2376bb8_20240704.gpx')
}
track = gpx$tracks[[1]]

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

windowsize = timewindow(track$Time, 100);
#latsd = rollsd(track$Latitude, windowsize);
#lonsd = rollsd(track$Longitude, windowsize);

zt = zooify(post_process(track))

debug = NULL
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
  low = x$lat_sd + x$lon_sd < lowt
  high = x$lat_sd + x$lon_sd < hight
  merge(
    x,
    low,
    high
  )
}

roll = roll_cols(zt, 60, sd, na.rm=T)
rolled = merge(zt, roll)



t = ggplot(track, aes(x=Time, y=((latsd+lonsd)/2)*1e5)) +
  geom_point() +
  scale_x_datetime(timezone="America/Los_Angeles") +
  lims(y=c(0,200))
c = ggplot(track, aes(color=Time, x=rollsd(Longitude, windowsize)*1e5, y=rollsd(Latitude, windowsize)*1e5, label=strftime(Time, "%H:%M"))) +
  geom_point() +
  geom_text() +
  scale_color_datetime(timezone="America/Los_Angeles")

#sdev = track %>% rowwise() %>% mutate(sdev = sd(track[between(track$Time, Time - 100, Time + 100),]$Latitude))
#d = ggplot(sdev, aes(x=Time, y=sdev)) + geom_point()
