const { rateLimit } = require('express-rate-limit');
function requestLimit(limit,windowMs) {
    return rateLimit({limit,windowMs,standardHeaders:'draft-8',legacyHeaders:false,
        message:{error:{code:'RATE_LIMITED',message:'Too many requests. Please try again later.'}}});
}
module.exports={requestLimit};
