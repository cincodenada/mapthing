library('data.table')
library('geosphere')
library('gpx')
library('tidyverse')

source('gpxutil.R')

if(!exists('gpx')) {
  gpx = read_gpx('1050d3c2d2376bb8_20240704.gpx')
}
track = gpx$tracks[[1]]

zt = zooify(post_process(track))

debug = NULL

if(!exists('roll')) {
  roll = roll_cols(zt, 60, sd, na.rm=T)
}
thresh = thresh(roll, 20, 50)
edges = tidy(edge(thresh)) %>%
  filter(value != lag(value) | row_number() == 1) %>%
  reframe(
    start_time=index,
    end_time=lead(index),
    type=ifelse(value=="start","stop","go")
  )

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
